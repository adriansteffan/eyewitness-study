/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Experiment,
  BaseComponentProps,
  ExperimentConfig,
  shuffle,
  now,
  FileUpload,
  getParam,
  ProlificEnding,
} from '@adriansteffan/reactive';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
} from '@dnd-kit/core';
import {
  useSortable,
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';

import { CSS } from '@dnd-kit/utilities';

interface CSVRow {
  stimulus: number;
  option: number;
  eyewitness1: number;
  eyewitness2: number;
  category: string;
  [key: string]: string | number;
}

type TrialType = 'rank' | 'dnd' | 'consec';

function parseCSV(csvString: string): CSVRow[] {
  const lines: string[] = csvString.trim().split('\n');
  const headers: string[] = lines[0]
    .split(',')
    .map((header) => header.replace(/"/g, ''))
    .map((header) => header.replace('\r', ''));

  return lines.slice(1).map((line) => {
    const values: string[] = line.split(',').map((value) => value.replace(/"/g, ''));
    return headers.reduce<CSVRow>((obj, header, index) => {
      const value = values[index];
      obj[header] = isNaN(Number(value)) ? value.replace('\r', '') : Number(value);
      return obj;
    }, {} as CSVRow);
  });
}

async function loadAndParseCSV(filename: string): Promise<CSVRow[]> {
  try {
    const response: Response = await fetch(`/${filename}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText: string = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error('Error loading or parsing CSV:', error);
    return [];
  }
}

interface Option {
  option: number;
  eyewitness1: number;
  eyewitness2: number;
}

type OptionData = Option & { picked: { num: number; time: number }[] };

interface GroupedStimulus {
  category: string;
  stimulusIDwithinCategory: number;
  options: Option[];
}

const loadAllStimuli = async () => {
  try {
    const allData = await Promise.all(
      [
        'filler_stimuli_3options.csv',
        'filler_stimuli_4options.csv',
        'target_stimuli_3options.csv',
        'target_stimuli_4options.csv',
      ].map(loadAndParseCSV),
    );
    const flatData = allData.flat();

    const groupedData = flatData.reduce<GroupedStimulus[]>((acc, row) => {
      const existingStimulus = acc.find(
        (s) => s.category === row.category && s.stimulusIDwithinCategory === row.stimulus,
      );

      if (existingStimulus) {
        existingStimulus.options.push({
          option: row.option,
          eyewitness1: row.eyewitness1,
          eyewitness2: row.eyewitness2,
        });
      } else {
        acc.push({
          category: row.category,
          stimulusIDwithinCategory: row.stimulus,
          options: [
            {
              option: row.option,
              eyewitness1: row.eyewitness1,
              eyewitness2: row.eyewitness2,
            },
          ],
        });
      }

      return acc;
    }, []);

    return groupedData;
  } catch (error) {
    console.error('Error loading stimuli:', error);
    return [];
  }
};

const stimuli = shuffle(
  (await loadAllStimuli())
    .slice(0, getParam('nitems', undefined, 'number'))
    .map((stimulus) => [
      { ...stimulus, type: 'consec' },
      { ...stimulus, type: 'dnd' },
    ])
    .flat(),
);

const config: ExperimentConfig = { showProgressBar: false };

export function SortableItem(props: { id: any; data: OptionData }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: isDragging ? ('relative' as const) : ('inherit' as const),
    zIndex: isDragging ? 1000 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex ${isDragging ? 'bg-yellow-300' : ''} w-full bg-white hover:bg-yellow-300 transition-colors touch-none`}
      {...attributes}
      {...listeners}
    >
      <div className='cursor-move p-4 border-r-4 border-b-2 border-t-2 border-l-2 border-black font-mono text-xl flex-1'>
        {props.data.eyewitness1.toFixed(2)}
      </div>
      <div className='cursor-move p-4 border-r-4 border-b-2 border-t-2 border-black font-mono text-xl flex-1'>
        {props.data.eyewitness2.toFixed(2)}
      </div>
      <div className='cursor-move p-4 border-r-2 border-b-2 border-t-2 border-black text-center w-16 flex justify-center items-center'>
        <div className='cursor-move flex justify-center items-center'>
          <div className='grid grid-cols-2 gap-1'>
            {[...Array(6)].map((_, i) => (
              <div key={i} className='w-1 h-1 rounded-full bg-gray-900'></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const DNDTable = ({ data, next }: { data: OptionData[]; next: (data: OptionData[]) => void }) => {
  const [items, setItems] = useState(data.map((item) => item.option));
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
  );

  const [hasDragged, setHasDragged] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  function handleDragStart() {
    if (!hasDragged) {
      setHasDragged(true);
    }
  }

  const startedTimestampRef = useRef(now());

  const handleConfirm = () => {
    if (!hasDragged) {
      // Show confirmation dialog if user hasn't dragged anything
      setShowConfirmation(true);
      return;
    }

    // Process and continue if user has already dragged
    submitData();
  };

  const submitData = () => {
    // global duration, since item level duration does not make sense for the dnd ordering task
    const duration = now() - startedTimestampRef.current;

    const updatedData = [...data];

    items.forEach((itemOption, index) => {
      const dataIndex = updatedData.findIndex((item) => item.option === itemOption);
      if (dataIndex !== -1) {
        updatedData[dataIndex].picked.push({
          num: index + 1,
          time: duration,
        });
      }
    });

    next(updatedData);
  };

  function handleDragEnd(event: { active: any; over: any }) {
    const { active, over } = event;

    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  // Width for the arrow column for consistency consistent
  const arrowWidth = 'w-16';

  return (
    <>
      <div className='flex flex-col'>
        <div className={`flex flex-row items-start`}>
          <div className={`${arrowWidth}`}></div>
          <div className='w-full'>
            <div className='border-4 border-t-4 border-l-4 border-r-4 border-b-0 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
              <div className='flex w-full bg-black text-white text-base sm:text-xl'>
                <div className='p-4 text-left border-r-4 border-black font-mono flex-1'>
                  Eyewitness <span className='text-base'>#</span>
                </div>
                <div className='p-4 text-left border-r-4 border-black font-mono flex-1'>
                  Eyewitness <span className='text-2xl'>&lowast;</span>
                </div>
                <div className='p-4 text-center w-16'></div>
              </div>
            </div>
          </div>
        </div>

        <div className='flex flex-row'>
          <div className={`flex flex-col py-5 items-center justify-between ${arrowWidth}`}>
            <div className='text-sm font-bold mb-1'>most</div>
            <svg viewBox='0 0 30 100' className='w-8 h-full'>
              <line x1='15' y1='10' x2='15' y2='90' stroke='black' strokeWidth='2' />
              <line x1='15' y1='10' x2='8' y2='20' stroke='black' strokeWidth='2' />
              <line x1='15' y1='10' x2='22' y2='20' stroke='black' strokeWidth='2' />
              <line x1='15' y1='90' x2='8' y2='80' stroke='black' strokeWidth='2' />
              <line x1='15' y1='90' x2='22' y2='80' stroke='black' strokeWidth='2' />
            </svg>
            <div className='text-sm font-bold mt-1'>least</div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            modifiers={[restrictToParentElement, restrictToVerticalAxis]}
          >
            <div className='w-full border-4 border-t-0 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
              <SortableContext items={items} strategy={verticalListSortingStrategy}>
                <div className='w-full'>
                  {items.map((id) => {
                    const rowData = data.find((row) => row.option === id);
                    if (!rowData) return null;
                    return <SortableItem key={id} id={id} data={rowData} />;
                  })}
                </div>
              </SortableContext>
            </div>
          </DndContext>
        </div>
      </div>

      <button
        className='cursor-pointer mx-auto w-36 bg-white px-8 py-3 border-2 border-black font-bold text-black text-lg rounded-full shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none mt-6'
        onClick={handleConfirm}
      >
        Confirm
      </button>

      {showConfirmation && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white p-6 rounded-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full'>
            <h3 className='text-xl font-bold mb-4'>Confirm</h3>
            <p className='mb-6'>
              You haven't changed the order of the suspects. Are you sure you want to continue with
              the current order?
            </p>
            <div className='flex justify-end space-x-4'>
              <button
                onClick={() => setShowConfirmation(false)}
                className='px-4 py-2 border-2 border-black rounded-full hover:bg-gray-100'
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  submitData();
                }}
                className='px-4 py-2 bg-black text-white border-2 border-black rounded-full hover:bg-gray-800'
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const EyewitnessBlock = ({
  next,
  stimuli,
}: { stimuli: (GroupedStimulus & { type: TrialType })[] } & BaseComponentProps) => {
  const [stimulusCounter, setStimulusCounter] = useState(0);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (stimulusCounter >= stimuli.length) {
      next(data);
    }
  }, [stimulusCounter, stimuli.length, next, data]);

  if (stimulusCounter >= stimuli.length) {
    return null;
  }

  const stimulus = stimuli[stimulusCounter];
  return (
    <EyewitnessTable
      key={stimulusCounter}
      next={(newData) => {
        setData([
          ...data,
          {
            version: stimulus.type,
            category: stimulus.category,
            stimulusIdWithinCategory: stimulus.stimulusIDwithinCategory,
            option: newData,
          },
        ]);
        console.log([
          ...data,
          {
            version: stimulus.type,
            category: stimulus.category,
            stimulusIdWithinCategory: stimulus.stimulusIDwithinCategory,
            option: newData,
          },
        ]);
        setStimulusCounter(stimulusCounter + 1);
      }}
      confirmNeeded={false}
      version={stimulus.type}
      stimulus={stimulus.options}
    />
  );
};

const EyewitnessTable = ({
  next,
  version,
  stimulus,
  confirmNeeded = false,
}: {
  version: TrialType;
  stimulus: Option[];
  confirmNeeded: boolean;
} & BaseComponentProps) => {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [isPauseScreen, setIsPauseScreen] = useState<boolean>(true);
  const startedTimestampRef = useRef(now());
  const [data, setData] = useState<OptionData[]>(
    stimulus.map((s: Option) => ({ ...s, picked: [] })),
  );
  const [nSelection, setNSelection] = useState(1);

  const handleDndData = (updatedData: OptionData[]) => {
    setData(updatedData);
    next(updatedData);
  };

  useEffect(() => {
    if (nSelection > data.length) {
      next(data);
    }
  }, [nSelection, data, next]);

  useEffect(() => {
    startedTimestampRef.current = now();
  }, [isPauseScreen]);

  const handleChoice = useCallback(
    (index: number) => {
      const duration = now() - startedTimestampRef.current;
      setData((prevData) => {
        return prevData.map((item, i) =>
          i === index
            ? {
                ...item,
                picked: [
                  ...item.picked,
                  {
                    num: nSelection,
                    time: duration,
                  },
                ],
              }
            : item,
        );
      });

      setNSelection((prev) => prev + 1);

      if (version === 'rank' && nSelection + 1 <= data.length) {
        setIsPauseScreen(true);
      }
      startedTimestampRef.current = now();
    },
    [nSelection, data.length, version],
  );

  return (
    <div
      className='min-h-screen border-black max-w-xl m-auto w-full flex select-none'
      onClick={() => {
        if (isPauseScreen) setIsPauseScreen(false);
      }}
    >
      <div className='mt-8 md:mt-20 mx-auto flex flex-col gap-10'>
        {isPauseScreen && (
          <p className='mt-40 text-base sm:text-xl font-semibold'>
            Get ready! Click anywhere to make your next choice.
          </p>
        )}

        {!isPauseScreen && (
          <>
            {version !== 'dnd' && (
              <p className='text-base sm:text-xl'>
                Please rank the suspects according to the order of likelihood of having committed
                the crime, on the basis of the strengths of two eyewitness testimonies.
              </p>
            )}

            {version === 'dnd' && (
              <p className='text-base sm:text-xl mt-6'>
                Please rank the suspects according to whom you consider likely to have committed the
                crime (Most likely at the top and least likely at the bottom).
              </p>
            )}

            {version !== 'dnd' && (
              <table className='w-full border-collapse bg-white border-4 border-black overflow-x-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
                <thead>
                  <tr className='bg-black text-white text-base sm:text-xl'>
                    <th className='p-4 text-left border-b-4 border-r-4 border-black font-mono '>
                      Suspect
                    </th>
                    <th className='p-4 text-left border-b-4 border-r-4 border-black font-mono'>
                      Eyewitness <span className='text-base'>#</span>
                    </th>
                    <th className='p-4 text-left border-b-4 border-black font-mono'>
                      Eyewitness <span className='text-2xl '>&lowast;</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => (
                    <tr
                      key={row.option}
                      className={` ${
                        selectedRow === row.option
                          ? 'bg-yellow-300'
                          : `bg-white ${confirmNeeded ? 'hover:bg-yellow-100' : 'hover:bg-yellow-300'} transition-colors`
                      }`}
                    >
                      <td className='p-4 border-r-4 border-b-4 border-black'>
                        <div className='relative inline-flex mt-1 items-center justify-center'>
                          {(row.picked.length === 0 || version === 'rank') && (
                            <button
                              type='button'
                              onClick={() => {
                                if (!confirmNeeded) {
                                  handleChoice(index);
                                } else {
                                  setSelectedRow(selectedRow === row.option ? null : row.option);
                                }
                              }}
                              className={`w-6 h-6 border-4 border-black
                            ${confirmNeeded ? ' rounded-full' : ''}
                          ${selectedRow === row.option ? 'bg-yellow-300' : ''}`}
                            >
                              {selectedRow === row.option && (
                                <div className='w-2 h-2 m-auto rounded-full bg-black' />
                              )}
                            </button>
                          )}
                          {row.picked.length !== 0 && <div className='w-6 h-6'></div>}
                        </div>
                      </td>
                      <td className='p-4 border-r-4 border-b-4 border-black font-mono text-xl'>
                        {(row.picked.length == 0 || version === 'rank') && (
                          <>{row.eyewitness1.toFixed(2)}</>
                        )}
                      </td>
                      <td className='p-4 border-b-4 border-black font-mono text-xl'>
                        {(row.picked.length == 0 || version === 'rank') && (
                          <>{row.eyewitness2.toFixed(2)}</>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {version === 'dnd' && <DNDTable data={data} next={handleDndData} />}

            <p className='text-base sm:text-xl'>
              {version === 'rank' && (
                <>
                  Please tick the suspect‘s {confirmNeeded ? 'field' : 'box'}{' '}
                  <strong>who is number {nSelection}</strong> in your ranking!
                </>
              )}
              {version === 'consec' && (
                <>
                  Please tick the suspect‘s {confirmNeeded ? 'field' : 'box'} whom you consider{' '}
                  <strong> most likely </strong>to have committed the crime!
                </>
              )}
            </p>

            {version !== 'dnd' && (
              <button
                className={`${selectedRow === null ? 'invisible ' : ''} ${!confirmNeeded ? 'hidden ' : ''} cursor-pointer mx-auto w-36 bg-white px-8 py-3 border-2 border-black font-bold text-black text-lg rounded-full shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none`}
                onClick={() => {
                  handleChoice((selectedRow ?? 1) - 1);
                }}
              >
                Confirm
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface Trial {
  category: string;
  version: string;
  stimulusIdWithinCategory: number;
  option: OptionData[];
}

interface ProcessedRow {
  stimulusidwithincategory: number;
  category: string;
  option: number;
  eyewitness1: number;
  eyewitness2: number;
  pickedAsNr1: boolean;
  pickedAsNr2: boolean;
  pickedAsNr3: boolean;
  pickedAsNr4: boolean;
  timePickedNr1: number | undefined;
  timePickedNr2: number | undefined;
  timePickedNr3: number | undefined;
  timePickedNr4: number | undefined;
}

const processJsonToCSVs = (sessionID: number, data: any[]): FileUpload[] => {
  const eyewitnessBlock = data.find((item) => item.type === 'EyewitnessBlock');
  const trials: Trial[] = eyewitnessBlock?.data || [];

  const rows: ProcessedRow[] = trials.flatMap((trial) =>
    trial.option.map((opt) => ({
      version: trial.version,
      category: trial.category,
      stimulusidwithincategory: trial.stimulusIdWithinCategory,
      option: opt.option,
      eyewitness1: opt.eyewitness1,
      eyewitness2: opt.eyewitness2,
      pickedAsNr1: !!opt.picked.find((p) => p.num == 1),
      pickedAsNr2: !!opt.picked.find((p) => p.num == 2),
      pickedAsNr3: !!opt.picked.find((p) => p.num == 3),
      pickedAsNr4: !!opt.picked.find((p) => p.num == 4),
      timePickedNr1: opt.picked.find((p) => p.num == 1)?.time,
      timePickedNr2: opt.picked.find((p) => p.num == 2)?.time,
      timePickedNr3: opt.picked.find((p) => p.num == 3)?.time,
      timePickedNr4: opt.picked.find((p) => p.num == 4)?.time,
    })),
  );

  const headers = Object.keys(rows[0]).join(',');
  const csvRows = rows.map((row) =>
    Object.values(row)
      .map((value) => (value === null ? '' : value))
      .join(','),
  );

  const survey = data.find((item) => item.name === 'survey').data;

  const csvRowsSurvey = survey.map(
    (surveyItem: { name: string; value: string }) =>
      `${sessionID},${surveyItem.name},${surveyItem.value}`,
  );

  return [
    {
      filename: `${sessionID}_trialdata.csv`,
      encoding: 'utf8',
      content: [headers, ...csvRows].join('\n'),
    },
    {
      filename: `${sessionID}_survey.csv`,
      encoding: 'utf8',
      content: ['sessionID,measure,value', ...csvRowsSurvey].join('\n'),
    },
  ];
};

const experiment = [
  {
    name: 'consenttext',
    type: 'Text',
    props: {
      buttonText: 'Accept',
      animate: true,

      content: (
        <div>
          <h1>Participant Information</h1>
          <p>
            Thank you for your interest in our research project. Enclosed you will find information
            about the research project, the conditions of participation and the handling of the
            collected data. Please read everything carefully. If you agree and want to participate
            in the experiment, please confirm by giving your consent below.
          </p>
          <p>
            <strong>General information about the research project:</strong> <br />
            This study investigates how people make decisions in a multi-attribute situation. The
            study takes about 30 minutes in total and includes tasks in which you are asked to
            estimate the likelihood of fictive subjects having committed fictive crimes, based on
            fictive eye-witness statements. No special stress or harm is expected as a result of
            participating in this research project. Participation in the study is remunerated at 10€
            per hour, rounded up to the nearest minute. Even if you decide to withdraw from the
            study, you are still entitled to receive the corresponding remuneration for the time
            spent up to that point, provided that this can be clearly demonstrated (see section
            Voluntary participation).
          </p>
          <p>
            <strong>Voluntary participation:</strong> <br />
            Your participation in this research project is voluntary. You can withdraw your consent
            to participate at any time and without giving reasons, without receiving any
            disadvantages. Even if you decide to withdraw from the study, you are still entitled to
            receive the corresponding remuneration for the time spent up to that point, provided
            that this can be clearly demonstrated.
          </p>
          <p>
            <strong>Participation requirements:</strong> <br />
            The only participation requirement is a minimum age of 18 years. Those who have already
            participated in this study are excluded from participation.
          </p>
          <p>
            <strong>Data protection and anonymity:</strong> <br />
            Apart from gender and education status, no personal data are collected as part of this
            study. It is therefore not possible for us to personally identify you. As a user of
            Prolific, you have entered into a separate{' '}
            <a target='_blank' href='https://participant-help.prolific.com/en/article/498241'>
              personal data processing agreement with Prolific
            </a>
            . This agreement is independent of your consent related to this study and the personal
            data collected by Prolific will not be made available to the research team of this study
            at any point.
          </p>
          <p>
            <strong>Use of data:</strong> <br />
            The results of this study may be published for teaching and research purposes (e.g.
            theses, scientific publications or conference papers). These results will be presented
            in anonymized form, i.e. without the data being able to be connected to a specific
            person. The fully anonymized data of this study will be made available as "open data" in
            an internet-based repository, if applicable. Thus, this study follows the
            recommendations of the German Research Foundation (DFG) for quality assurance with
            regard to verifiability and reproducibility of scientific results, as well as optimal
            data re-use. If you would like to receive information on the scientific results of the
            study after its completion, please send an e-mail to Elisabeth Kraus
            (e.kraus@psy.lmu.de).
          </p>
          <p>
            <strong>Legal basis and revocation:</strong> <br />
            The legal basis for processing the aforementioned personal data is the consent pursuant
            to Art. 6 (1) letter a EU-DSGVO at the end of this document. You have the right to
            revoke the data protection consent at any time. The revocation does not affect the
            lawfulness of the processing carried out on the basis of the consent until the
            revocation. You can request an obligatory deletion of your data at any time - as long as
            you can provide sufficient information that allows us to identify your data. To do so,
            please contact the research project managers. You will not suffer any disadvantages as a
            result of the revocation.
          </p>
          <p>
            <strong>Research project managers:</strong> <br />
            If you have any questions about the research project or if you want to exercise your
            right to withdraw your consent, please contact the research project managers:
          </p>
          <p>
            Dr. Elisabeth Kraus <br />
            Prof. Dr. Christopher Donkin
            <br />
          </p>
          <p>
            Ludwig-Maximilians-Universität München
            <br />
            Department Psychologie
            <br />
            Lehrstuhl für Computational Modeling in Psychology
            <br />
            Akademiestr. 7<br />
            80799 München
            <br />
          </p>
          <p>
            e.kraus@psy.lmu.de
            <br />
            c.donkin@psy.lmu.de
          </p>
          <p>
            <strong>Further contact addresses:</strong> <br />
            You can also contact the data protection officer of the research institution or the
            competent supervisory authority if you have any data protection concerns in connection
            with this study and/or wish to lodge a complaint.
          </p>
          <p>
            {' '}
            <br />
            Ludwig-Maximilians-Universität München <br />
            Behördlicher Datenschutzbeauftragter <br />
            Geschwister-Scholl-Platz 1 <br />
            D-80539 München <br />
            Bayerisches Landesamt für Datenschutzaufsicht <br />
            Promenade 27 <br />
            91522 Ansbach <br />
            <br />
            <br />
            Date: December 02, 2024
            <br />
            <br />
            <strong>Declaration of consent.</strong> I hereby certify that I have read and
            understood the participant information described above and that I agree to the
            conditions stated. I agree in accordance with Art. 6 (1) letter a EU-DSGVO. I have been
            informed about my right to revoke my data protection consent.
            <br />
            <br />
            <strong>Declaration of fulfillment inclusion criteria.</strong> I hereby confirm that I
            meet the above conditions for participation (18+ years old, first-time participation).
          </p>
        </div>
      ),
    },
  },
  {
    name: `survey`,
    type: 'Quest',
    props: {
      surveyJson: {
        pages: [
          {
            elements: [
              {
                type: 'radiogroup',
                name: 'dem_gender',
                title: 'What gender do you identify with?',
                isRequired: true,
                colCount: 1,
                choices: ['male', 'female', 'other'],
              },
              {
                type: 'radiogroup',
                name: 'dem_utility',
                title: 'How much do you know about utility theory?',
                isRequired: true,
                colCount: 1,
                choices: ['nothing', 'a little', 'a lot'],
              },
            ],
          },
        ],
      },
    },
  },
  {
    name: 'introtext',
    type: 'Text',
    props: {
      buttonText: "Let's Begin",
      animate: true,
      content: (
        <>
          <h1 className='text-4xl'>
            <strong>Instructions </strong>
          </h1>
          <br />
          You will see several suspects of a crime on each trial. You will be asked to either select
          the suspect who seems most likely to have committed the crime, or to rank the suspects
          according to their likelihood of having committed the crime, on the basis of the strengths
          of two eyewitness testimonies. The strengths of the eyewitness testimonies are presented
          on a 0–10 scale, with 0 implying very weak evidence of guilt and 10 implying very strong
          evidence of guilt. The testimonies of both eyewitnesses are equally valid and important,
          and the strengths of the testimonies are equated. You will not receive any feedback during
          the experiment, so there are no consequences for your selections. <br />
        </>
      ),
    },
  },
  {
    name: 'eyewitnesstrial',
    type: 'EyewitnessBlock',
    props: {
      stimuli: stimuli,
    },
  },
  {
    name: 'upload',
    type: 'Upload',
    props: {
      generateFiles: processJsonToCSVs,
    },
  },
  {
    name: 'thankyoutext',
    type: 'ProlificEnding',
    props: { prolificCode: import.meta.env.VITE_PROLIFIC_CODE },
  },
];

export default function App() {
  return (
    <Experiment
      config={config}
      timeline={experiment}
      components={{ EyewitnessBlock, ProlificEnding }}
    />
  );
}
