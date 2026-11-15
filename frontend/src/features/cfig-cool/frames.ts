// The real camera frames of test 21291C1 and their provenance. Everything here is written by
// docs/data/cfig-cool-flame-frames/extract_frames.py into assets/frames.json; nothing is typed by hand.
import meta from "./assets/frames.json";
import f39 from "./assets/frame-00039.jpg";
import f40 from "./assets/frame-00040.jpg";
import f41 from "./assets/frame-00041.jpg";
import f42 from "./assets/frame-00042.jpg";
import f44 from "./assets/frame-00044.jpg";
import f46 from "./assets/frame-00046.jpg";
import f48 from "./assets/frame-00048.jpg";
import reference from "./assets/psi-representative-cool-flames.jpg";

const URLS: Record<string, string> = {
  "frame-00039.jpg": f39,
  "frame-00040.jpg": f40,
  "frame-00041.jpg": f41,
  "frame-00042.jpg": f42,
  "frame-00044.jpg": f44,
  "frame-00046.jpg": f46,
  "frame-00048.jpg": f48,
};

export interface Frame {
  i: number;
  url: string;
  /** seconds from ignition (tests.ignition_gmt, 1 s resolution) */
  t_s: number;
  camera_time_gmt: string;
  /** share of R/G/B sub-pixels at full scale in the source TIFF */
  saturated_pct: number;
  mean_counts_of_4095: number;
  jpeg_bytes: number;
}

export interface ArchiveFrame {
  i: number;
  t_s: number;
  compressed_bytes: number;
}

export const TEST_ID = meta.test_id;
export const WIDTH = meta.stored_size_px[0];
export const HEIGHT = meta.stored_size_px[1];
export const SOURCE_SIZE = meta.source_size_px;
export const ARCHIVE_FILE = meta.archive_file;
export const T_ZERO = meta.t_zero;

export const FRAMES: Frame[] = meta.frames.map((f) => ({
  i: f.i,
  url: URLS[f.file],
  t_s: f.t_s,
  camera_time_gmt: f.camera_time_gmt,
  saturated_pct: f.saturated_pct,
  mean_counts_of_4095: f.mean_counts_of_4095,
  jpeg_bytes: f.jpeg_bytes,
}));

export const ARCHIVE: ArchiveFrame[] = meta.archive;

/** NASA's own representative image for the study, as published in PSI (no scale bar, 364 × 364 px). */
export const REFERENCE = {
  url: reference,
  psiFile:
    "PSI-159_Representative Image(s)_CFI-G_Observation of non-premixed quasi-steady spherical cool flames on porous burners.jpg",
  sha256: "bf89cf938c09c799c6edb23f962ba0c7abb9cfd633cbc7264099e133cd8f6201",
  bytes: 9866,
};
