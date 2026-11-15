import { useEffect, useState } from "react";
import { buildExperiment, type Experiment } from "./lib/experiment.ts";
import type { TestDetail, TimeSeries } from "./types";

export type ExperimentState =
  | { status: "pending" }
  | { status: "error"; message: string }
  | { status: "empty" } // the test exists but has no telemetry
  | { status: "ready"; experiment: Experiment };

/** null on 404: "no such series" is an answer, not an error. */
async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`/api/studies/same-r${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function useSameRExperiment(testNo: number): ExperimentState {
  const [state, setState] = useState<ExperimentState>({ status: "pending" });
  useEffect(() => {
    let live = true;
    setState({ status: "pending" });
    Promise.all([get<TestDetail>(`/tests/${testNo}`), get<TimeSeries>(`/tests/${testNo}/timeseries/hkp`)])
      .then(([detail, series]) => {
        if (!live) return;
        if (!detail) return setState({ status: "error", message: `no test #${testNo} in the experiment table` });
        const experiment = buildExperiment(detail, series);
        setState(experiment ? { status: "ready", experiment } : { status: "empty" });
      })
      .catch((e: Error) => live && setState({ status: "error", message: e.message }));
    return () => {
      live = false;
    };
  }, [testNo]);
  return state;
}
