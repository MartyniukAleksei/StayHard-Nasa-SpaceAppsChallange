/** Moments of hardware motion from the test log, seconds from ignition. null: not in the log. */
export interface ApparatusEvents {
  needlesRetract: number | null;
  igniterOn: number | null;
  igniterRetracted: number | null;
}

export interface LogTiming {
  /** Onboard time of t_s = 0 (igniter off), ms since the UTC epoch. null: no such line in the log. */
  ignitionEpochMs: number | null;
  events: ApparatusEvents;
}

// t_s in the ts_* tables counts from "AS Igniter Off/Retract Start" of the test log <CIR>.txt.
// Checked on FLEX-100: with this zero the UV flame leaves the frames at t = 6.1–6.3 s (table: 6.1 s).
const ZERO = "AS Igniter Off/Retract Start";

function stamp(log: string, label: string): number | null {
  const at = log.indexOf(`${label}:`);
  if (at < 0) return null;
  const m = /^\s*(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d(?:\.\d+)?)/.exec(log.slice(at + label.length + 1));
  return m ? Date.parse(`${m[1]}T${m[2]}Z`) : null;
}

export function parseLog(log: string): LogTiming {
  const ignitionEpochMs = stamp(log, ZERO);
  const rel = (label: string) => {
    const ms = stamp(log, label);
    return ms == null || ignitionEpochMs == null ? null : (ms - ignitionEpochMs) / 1000;
  };
  return {
    ignitionEpochMs,
    events: {
      needlesRetract: rel("AS Needles Retract"),
      igniterOn: rel("AS Burn to Completion/Igniter On"),
      igniterRetracted: rel("AS Retract Completed"),
    },
  };
}
