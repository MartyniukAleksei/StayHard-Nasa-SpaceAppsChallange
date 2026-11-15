import { fetchSeries, fetchTest, fetchText } from "../api";
import type { Source, TestDetail, TestRow } from "../types";
import { sample, toTrack, type Track } from "./series";

export interface Experiment {
  test: TestRow;
  detail: TestDetail;
  sources: Source[];
  droplet: Track;
  flameUv: Track | null;
  flameColor: Track | null;
  /** Бортовий час t_s = 0 (вимкнення запалювача), мс від епохи UTC. null — журналу немає. */
  ignitionEpochMs: number | null;
  /** Моменти роботи апаратури з журналу тесту, с від запалювання. null — у журналі немає. */
  events: ApparatusEvents;
  /** Де голки відпустили краплю (перша точка даних), мм. */
  deploySite: [number, number, number];
  tMin: number;
  tMax: number;
  /** Кінець даних про полум'я = момент згасання видимого/UV полум'я. */
  flameEnd: number | null;
}

export interface ApparatusEvents {
  needlesRetract: number | null;
  igniterOn: number | null;
  igniterRetracted: number | null;
}

// t_s у ts_* відлічується від «AS Igniter Off/Retract Start» журналу тесту <CIR>.txt.
// Перевірено на FLEX-100: за цим нулем UV-полум'я зникає з кадрів на t≈6.1–6.3 с (таблиця: 6.1 с).
const stamp = (log: string, label: string): number | null => {
  const m = new RegExp(`${label}:\\s*(\\d{4}-\\d\\d-\\d\\d) (\\d\\d:\\d\\d:\\d\\d(?:\\.\\d+)?)`).exec(log);
  return m ? Date.parse(`${m[1]}T${m[2]}Z`) : null;
};

export async function loadExperiment(testNo: number): Promise<Experiment> {
  const [detail, droplet, uv, color] = await Promise.all([
    fetchTest(testNo),
    fetchSeries(testNo, "droplet"),
    fetchSeries(testNo, "flame_uv"),
    fetchSeries(testNo, "flame_color"),
  ]);
  const dropletTrack = toTrack(droplet);
  if (!dropletTrack) throw new Error(`FLEX-${testNo} has no droplet time series — nothing to replay`);

  let ignitionEpochMs: number | null = null;
  const events: ApparatusEvents = { needlesRetract: null, igniterOn: null, igniterRetracted: null };
  const logFile = detail.files.find((f) => f.name === `${detail.test.cir_id}.txt`);
  if (logFile) {
    const log = await fetchText(logFile.url).catch(() => "");
    ignitionEpochMs = stamp(log, "AS Igniter Off/Retract Start");
    if (ignitionEpochMs != null) {
      const rel = (label: string) => {
        const ms = stamp(log, label);
        return ms == null ? null : (ms - ignitionEpochMs!) / 1000;
      };
      events.needlesRetract = rel("AS Needles Retract");
      events.igniterOn = rel("AS Burn to Completion/Igniter On");
      events.igniterRetracted = rel("AS Retract Completed");
    }
  }

  const flameUv = toTrack(uv);
  const flameColor = toTrack(color);
  const ends = [flameUv?.t1, flameColor?.t1].filter((v): v is number => v != null);
  const flameEnd = ends.length ? Math.max(...ends) : null;
  // показуємо секунду до відведення голок: крапля ще висить між ними
  const firstEvent = Math.min(dropletTrack.t0, events.needlesRetract ?? Infinity, events.igniterOn ?? Infinity);
  const experiment: Experiment = {
    test: detail.test,
    detail,
    sources: [...detail.sources, ...(droplet?.sources ?? []), ...(uv?.sources ?? []), ...(color?.sources ?? [])],
    droplet: dropletTrack,
    flameUv,
    flameColor,
    ignitionEpochMs,
    events,
    deploySite: [0, 0, 0],
    tMin: firstEvent - 1,
    tMax: Math.max(dropletTrack.t1, flameEnd ?? dropletTrack.t1) + 1.2,
    flameEnd,
  };
  experiment.deploySite = dropletPosition(experiment, dropletTrack.t0);
  return experiment;
}

/** Положення краплі, мм. x, y — з HiBMS (ts_droplet), z — з UV-камери (ts_flame_uv). Оцінка: дві проєкції. */
export function dropletPosition(e: Experiment, t: number): [number, number, number] {
  return [
    sample(e.droplet, "x_mm", t, true) ?? 0,
    sample(e.droplet, "y_mm", t, true) ?? 0,
    sample(e.flameUv, "droplet_z_mm", t, true) ?? 0,
  ];
}
