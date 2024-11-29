/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import {
  Experiment,
  BaseComponentProps,
  ExperimentConfig,
} from "reactive-psych";

const config: ExperimentConfig = { showProgressBar: false };

const EyewitnessBlock = ({
  next,
  stimuli,
}: { stimuli: object[][] } & BaseComponentProps) => {
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
  return (
    <EyewitnessTable
      next={(data) => {
        setData([{}]);
        setStimulusCounter(stimulusCounter + 1);
      }}
      confirmNeeded={false}
      version={"rank"}
      stimulus={stimuli[stimulusCounter]}
    />
  );
};

const EyewitnessTable = ({
  next,
  version,
  stimulus,
  confirmNeeded = false,
}: {
  version: "rank" | "consec";
  stimulus: object[];
  confirmNeeded: boolean;
} & BaseComponentProps) => {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [data, setData] = useState(stimulus);
  const [nSelection, setNSelection] = useState(1);

  return (
    <div className="min-h-screen border-black max-w-xl m-auto w-full flex">
      <div className="mt-20 mx-auto flex flex-col gap-10">
        <p className="text-xl">
          Please rank the suspects according to the order of likelihood of
          having committed the crime, on the basis of the strengths of two
          eyewitness testimonies.
        </p>
        <table className="w-full border-collapse bg-white border-4 border-black overflow-x-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <thead>
            <tr className="bg-black text-white text-base sm:text-xl">
              <th className="p-4 text-left border-b-4 border-r-4 border-black font-mono ">
                Suspect
              </th>
              <th className="p-4 text-left border-b-4 border-r-4 border-black font-mono">
                Eyewitness #
              </th>
              <th className="p-4 text-left border-b-4 border-black font-mono">
                Eyewitness *
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={row.id}
                className={` ${
                  selectedRow === row.id
                    ? "bg-yellow-300"
                    : "bg-white hover:bg-yellow-100 transition-colors"
                }`}
              >
                <td className="p-4 border-r-4 border-b-4 border-black">
                  <div className="relative inline-flex mt-1 items-center justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirmNeeded) {
                          next({}); // UPDATE
                        } else {
                          setSelectedRow(
                            selectedRow === row.id ? null : row.id
                          );
                        }
                      }}
                      className={`w-6 h-6 border-4 border-black
                        ${confirmNeeded ? " rounded-full" : ""}
                      ${selectedRow === row.id ? "bg-yellow-300" : ""}`}
                    >
                      {selectedRow === row.id && (
                        <div className="w-2 h-2 m-auto rounded-full bg-black" />
                      )}
                    </button>
                  </div>
                </td>
                <td className="p-4 border-r-4 border-b-4 border-black font-mono text-xl">
                  {row.eyewitnessHash}
                </td>
                <td className="p-4 border-b-4 border-black font-mono text-xl">
                  {row.eyewitnessStar}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-xl">
          {version === "rank" && (
            <>
              Please tick the suspect‘s {confirmNeeded ? 'field' : 'box'}{" "}
              <strong>who is number {nSelection}</strong> in your ranking!
            </>
          )}
          {version === "consec" && (
            <>
              Please tick the suspect‘s {confirmNeeded ? 'field' : 'box'} whom you consider{" "}
              <strong> most likely </strong>to have committed the crime!
            </>
          )}
        </p>
        <button
          className={`${selectedRow === null || !confirmNeeded ? "invisible " : ""} mx-auto w-36 bg-white px-8 py-3 border-2 border-black font-bold text-black text-lg rounded-full shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none`}
          onClick={() => {
            next({}); // UPDATE
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
};

const experiment = [
  {
    name: "introtext",
    type: "Text",
    props: {
      buttonText: "Let's Begin",
      animate: true,
      content: (
        <>
          <h1 className="text-4xl">
            <strong>Instructions </strong>
          </h1>
          <br />
          You will see several suspects of a crime on each trial. You will be
          asked to either select the suspect who seems most likely to have
          committed the crime, or to rank the suspects according to their
          likelihood of having committed the crime, on the basis of the
          strengths of two eyewitness testimonies. The strengths of the
          eyewitness testimonies are presented on a 0–1 scale, with 0 implying
          very weak evidence of guilt and 1 implying very strong evidence of
          guilt. The testimonies of both eyewitnesses are equally valid and
          important, and the strengths of the testimonies are equated. You will
          not receive any feedback during the experiment, so there are no
          consequences for your selections. <br />
        </>
      ),
    },
  },
  {
    name: "customtrial",
    type: "EyewitnessBlock",
    props: {
      stimuli: [
        [
          { id: 1, eyewitnessHash: 0.6, eyewitnessStar: 0.4 },
          { id: 2, eyewitnessHash: 0.471, eyewitnessStar: 0.338 },
          { id: 4, eyewitnessHash: 0.471, eyewitnessStar: 0.338 },
          { id: 3, eyewitnessHash: 0.337, eyewitnessStar: 0.516 },
        ],
      ],
    },
  },
  {
    name: "upload",
    type: "Upload",
  },
  {
    name: "finaltext",
    type: "Text",
    props: {
      buttonText: null,
      content: (
        <>
          Thank you for participating in our study, you can now close the
          browser window.
        </>
      ),
    },
  },
];

export default function App() {
  return (
    <Experiment
      config={config}
      timeline={experiment}
      components={{ EyewitnessBlock }}
    />
  );
}
