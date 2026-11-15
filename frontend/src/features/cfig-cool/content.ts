// Curated copy for the PSI-159 page. No counts of our data here: every count on the page comes from
// /api/studies/cfig/regime. Numbers below are citations of papers or of NASA's own setup files and carry
// a [[source]] marker. See Cited.tsx.

export const STAGES = [
  {
    n: "1",
    title: "Hot flame quenches",
    text: "The hot flame loses heat to radiation and flow and goes out; the camera view blacks out. [[kim2023]]",
  },
  {
    n: "2",
    title: "About 1 s of darkness",
    text: "Nothing luminous is seen for about a second, yet the burner is still hot and the sensors still read a signal. [[kim2023]]",
  },
  {
    n: "3",
    title: "Cool flame emerges",
    text: "Fuel meeting the hot porous burner ignites again as a faint cool flame, a shell about 6 mm thick at 600–1000 K, against 1100–2200 K for a hot flame. [[kim2023]]",
  },
] as const;

export interface CalloutDef {
  id: string;
  label: string;
  title: string;
  paragraphs: string[];
}

export const CALLOUTS_PAUSE: CalloutDef[] = [
  {
    id: "discovery",
    label: "Discovery",
    title: "A signal in the sensors, then a brighter picture",
    paragraphs: [
      "Graduate student Minhyeng Kim noticed that a heat sensor kept reading a signal after the hot flame had gone out and the camera view had gone dark. Student Kendyl Waddell then enhanced the intensified video feed, which revealed a cool flame about 6 mm thick. [[iss_reports]] [[kim2023]]",
    ],
  },
  {
    id: "inertia",
    label: "Thermal inertia and modelling",
    title: "The burner remembers the hot flame",
    paragraphs: [
      "Residual heat in the porous burner re-ignited the flowing n-butane after the pause, and burner temperature played a critical role in whether a cool flame appeared at all. [[kim2023]]",
      "That is why a model must solve heat transfer inside the burner together with the gas (conjugate heat transfer) to reproduce the re-ignition [[ahmed2024]]. The same work prompted Forman Williams to revise the published simplified cool-flame chemistry. [[iss_reports]]",
    ],
  },
  {
    id: "dark",
    label: "Why raw video looks dark",
    title: "A hot flame is about 140 times brighter",
    paragraphs: [
      "In the ground analogue experiment, hot flames were about 140 times more luminous than cool flames, which is why a cool flame needs a 1 s exposure where a hot flame needs 10 ms. [[waddell2023]] One exposure cannot serve both: at the setting that shows the cool flame, the hot flame floods the sensor, and at the setting that resolves the hot flame, the cool flame vanishes. Move the slider above to see it in a real frame.",
    ],
  },
];

export const CALLOUTS_MAP: CalloutDef[] = [
  {
    id: "window",
    label: "Narrow stability window",
    title: "Steady spherical cool flames needed one recipe",
    paragraphs: [
      "Across the three fuels (ethane, propane and n-butane), steady spherical gaseous cool flames were achieved only in normal n-butane flames at 2 bar and XO₂ = 0.39, near a mixture fraction of 0.53. The hot flames that spawned them were 2.6 times larger. [[kim2023]]",
    ],
  },
];

export interface PitfallDef {
  id: string;
  title: string;
  text: string;
}

export const PITFALLS: PitfallDef[] = [
  {
    id: "termination",
    title: "1 · Physical or hardware termination (SE vs FT)",
    text: "SE is a flame that went out by itself. FT means the run was ended by a flow cut or a hardware limit, such as the burner temperature limit. Only SE says something about the flame. The chamber is closed (about 100 L), so oxygen is also used up as the test runs: compare XO₂ before and after. [[stocker2022]]",
  },
  {
    id: "timescale",
    title: "2 · Timescale and radiation limits",
    text: "The ISS tests lasted up to 870 s, while a diffusive steady state takes about 100,000 s to establish, and radiative extinction sets in at a critical flame temperature of 1130 K. A flame that is still burning at the end of a test is not yet a steady flame. [[irace2023]]",
  },
  {
    id: "optical",
    title: "3 · Optical thickness bias",
    text: "Radiation models that treat the gas as optically thin lose accuracy at higher pressure, where products reabsorb part of the emitted light. [[waddell2024]]",
  },
  {
    id: "sensors",
    title: "4 · Sensor uncertainty and oscillations",
    text: "In the ground analogue, Type-K thermocouples were good to ±5 K but only up to 1533 K, gravimetric flow was good to ±10% and CH₂O to ±1 ppm. Near-limit cool flames oscillated by about 60 K around an ignition and extinction temperature of 550 ± 20 K, so a single reading at one moment can sit anywhere inside that band. [[waddell2023]]",
  },
];

/** Imaging passport: what is known about how the frames were taken. `src` points at the file it comes from. */
export const PASSPORT_STATIC = {
  gravity: "0 g (International Space Station)",
  camera: "ACME data camera (IPSU 5), 1360 × 1024 px",
  exposure: "1.0 s before ignition, 5.0 s during the test",
  exposureSrc: "as-run file “as run21291C1.txt”, raw/21291C1/",
  darkFrames: "none subtracted (the conversion log lists no dark images)",
  scale:
    "converted TIFF: 0–4095 counts, shown linearly. Shown here at 680 × 512 px (2 × 2 average), stored square-root coded",
  filter:
    "filter wheel position 2 for this camera (what that filter is, is not documented in the snapshot). A separate intensified camera also recorded the test; its 9 GB raw stream is not shown here",
  barScale: "none: the files carry no pixel-to-millimetre calibration, so no scale bar is drawn",
  regime: "cool flame 600–1000 K, hot flame 1100–2200 K",
  diagnostics:
    "3 mass-flow controllers, a thermocouple rake, 3 photomultipliers (230–700 nm, with 310 nm OH* and 430 nm CH* bands) and a linear radiometer array (0.2–11 µm) including a burner-masked channel",
} as const;

/** What each real frame shows, in words. These are our descriptions of the pictures, not NASA labels. */
export const OBSERVATIONS: Record<number, string> = {
  39: "Teal spherical glow around the burner tip and its stem.",
  40: "The same teal sphere, dimmer, with a bluer rim.",
  41: "Every sub-pixel is at full scale: the sensor is flooded.",
  42: "An orange-white bloom fills most of the frame.",
  44: "A bright white sphere with an orange halo and glowing particles.",
  46: "A smaller bright sphere with a teal edge; the burner stem is visible again.",
  48: "Almost dark: no flame is visible at this exposure, only a small bright streak.",
};
