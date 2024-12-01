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
} from 'reactive-psych';

interface CSVRow {
  stimulus: number;
  option: number;
  eyewitness1: number;
  eyewitness2: number;
  category: string;
  [key: string]: string | number;
}

type TrialType = 'rank' | 'consec';

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
      { ...stimulus, type: 'rank' },
      { ...stimulus, type: 'consec' },
    ])
    .flat(),
);

const config: ExperimentConfig = { showProgressBar: false };

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
      className='min-h-screen border-black max-w-xl m-auto w-full flex'
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
            <p className='text-base sm:text-xl'>
              Please rank the suspects according to the order of likelihood of having committed the
              crime, on the basis of the strengths of two eyewitness testimonies.
            </p>
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
                        <>{row.eyewitness1.toFixed(3)}</>
                      )}
                    </td>
                    <td className='p-4 border-b-4 border-black font-mono text-xl'>
                      {(row.picked.length == 0 || version === 'rank') && (
                        <>{row.eyewitness2.toFixed(3)}</>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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
            <button
              className={`${selectedRow === null ? 'invisible ' : ''} ${!confirmNeeded ? 'hidden ' : ''} mx-auto w-36 bg-white px-8 py-3 border-2 border-black font-bold text-black text-lg rounded-full shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none`}
              onClick={() => {
                handleChoice((selectedRow ?? 1) - 1);
              }}
            >
              Confirm
            </button>
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

  return [
    {
      filename: `${sessionID}_trialdata.csv`,
      encoding: 'utf8',
      content: [headers, ...csvRows].join('\n'),
    },
  ];
};

const experiment = [
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
    name: `survey`,
    type: 'Quest',
    props: {
      surveyJson: {
        pages: [
          {
            elements: [
              {
                type: 'rating',
                name: 'sad',
                title:
                  'Demographic questions could be here. How sad are you that they are missing?',
                isRequired: true,
                rateMin: 1,
                rateMax: 6,
                minRateDescription: 'Not at all',
                maxRateDescription: 'Extremely',
              },
            ],
          },
        ],
      },
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
    name: 'finaltext',
    type: 'Text',
    props: {
      buttonText: null,
      content: <>Thank you for participating in our study, you can now close the browser window.</>,
    },
  },
];

export default function App() {
  return <Experiment config={config} timeline={experiment} components={{ EyewitnessBlock }} />;
}
