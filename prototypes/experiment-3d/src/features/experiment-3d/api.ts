import type { CameraInfo, FramesIndex, TestDetail, TimeSeries } from "./types";

// Той самий контракт, що в frontend/src/shared/api/client.ts — при перенесенні замінити на apiGet.
const BASE = import.meta.env.VITE_API_URL ?? "";

export const apiUrl = (path: string) => `${BASE}${path}`;

async function get(path: string): Promise<Response> {
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res;
}

export const fetchTest = (n: number) =>
  get(`/api/studies/flex/tests/${n}`).then((r) => r.json() as Promise<TestDetail>);

export async function fetchSeries(n: number, signal: string): Promise<TimeSeries | null> {
  const res = await fetch(apiUrl(`/api/studies/flex/tests/${n}/timeseries/${signal}?max_points=20000`));
  if (res.status === 404) return null; // у тесту немає цього сигналу
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${signal}`);
  return res.json() as Promise<TimeSeries>;
}

export const fetchText = (url: string) => get(url).then((r) => r.text());

export const fetchCameras = (n: number) =>
  get(`/api/media/flex/${n}/cameras`)
    .then((r) => r.json() as Promise<{ cameras: CameraInfo[] }>)
    .then((j) => j.cameras);

export const fetchFramesIndex = (n: number, camera: string) =>
  get(`/api/media/flex/${n}/cameras/${camera}/frames`).then((r) => r.json() as Promise<FramesIndex>);

export const frameUrl = (index: FramesIndex, i: number, maxSide: number) =>
  apiUrl(`${index.frame_url.replace("{i}", String(i))}?max_side=${maxSide}`);
