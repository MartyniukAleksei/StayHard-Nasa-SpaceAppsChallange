// Curated copy for the FLEX library (5B): data dictionary, publication topics, section menu.
// No counts here — counts on the page come from /api/studies/flex/library.

export type Field = { name: string; unit: string; meaning: string; derived?: boolean };

/** Per-test fields as the API returns them (TestSummary / TestDetail). */
export const TEST_FIELDS: Field[] = [
  { name: "test_no", unit: "—", meaning: "Test number in the FLEX experimental table." },
  { name: "cir_id", unit: "—", meaning: "Run identifier in the Combustion Integrated Rack (CIR)." },
  { name: "test_date, test_gmt", unit: "date, GMT", meaning: "When the test ran aboard the ISS." },
  { name: "fuel", unit: "—", meaning: "Liquid fuel of the droplet: Heptane or Methanol." },
  { name: "p_atm", unit: "atm", meaning: "Chamber pressure from the experimental table." },
  { name: "x_o2, x_n2, x_co2, x_he", unit: "mole fraction", meaning: "Composition of the chamber atmosphere (0.21 = 21%)." },
  { name: "diluent", unit: "—", meaning: "Main inert gas mixed with oxygen: N₂, CO₂ or He." },
  { name: "temperature_k", unit: "K", meaning: "Chamber gas temperature from the test sheet." },
  { name: "d0_mm", unit: "mm", meaning: "Initial droplet diameter." },
  { name: "dext_mm", unit: "mm", meaning: "Droplet diameter when the flame went out." },
  { name: "k_mm2_s", unit: "mm²/s", meaning: "Burning-rate constant K from d² = d₀² − K·t, as reported by NASA." },
  { name: "burn_time_s", unit: "s", meaning: "Time from ignition to the end of visible burning." },
  {
    name: "end_type",
    unit: "—",
    meaning:
      "How the test ended: Extinction (flame went out by itself), Completion (droplet burned away) or Disruption (test ended early; self-extinction was not observed).",
  },
  { name: "fiber", unit: "yes / no / unknown", meaning: "Droplet held on a support fiber instead of free-floating. Never mix the two groups." },
  { name: "comment", unit: "text", meaning: "Researcher comment from the test sheet." },
  { name: "has_series", unit: "yes / no", meaning: "Both droplet and UV-flame time series exist for the test.", derived: true },
  { name: "has_video", unit: "yes / no", meaning: "An mp4 recording is available in this app.", derived: true },
  { name: "cool_flame", unit: "yes / no", meaning: "Researcher comment mentions cool-flame burning (keyword match).", derived: true },
];

/** Columns of series.csv (one row per measured point). */
export const SERIES_FIELDS: Field[] = [
  { name: "signal", unit: "—", meaning: "Which measurement the row belongs to: droplet_d_mm, flame_d_mm or standoff." },
  { name: "t_s", unit: "s", meaning: "Time from ignition; negative values are before ignition." },
  { name: "droplet_d_mm", unit: "mm", meaning: "Droplet diameter measured from backlit images." },
  { name: "flame_d_mm", unit: "mm", meaning: "Flame diameter measured from UV (OH*) images." },
  { name: "standoff", unit: "ratio", meaning: "Flame diameter divided by droplet diameter." },
];

export type Topic = { id: string; label: string; match: RegExp };

/** Publication topics: our keyword match on titles, labelled derived in the UI. */
export const PUB_TOPICS: Topic[] = [
  { id: "cool", label: "cool flames", match: /cool[- ]?flame/i },
  { id: "extinction", label: "extinction", match: /extinction|extingu/i },
  { id: "diluent", label: "CO₂ / He / inert", match: /carbon[- ]dioxide|\bco2\b|helium|inert|diluent/i },
  { id: "fiber", label: "support fibers", match: /fiber|tether/i },
  { id: "methanol", label: "methanol", match: /methanol/i },
  { id: "heptane", label: "heptane", match: /heptane/i },
];

/** Known caveats in words; every count on the page comes from the API. */
export const CAVEATS: { text: string; test?: number }[] = [
  {
    text: "In some tests the test sheet (Summary.pdf) disagrees with the experimental table, e.g. on chamber pressure. The app shows the table values; check the test sheet for the test you use.",
    test: 273,
  },
  { text: "K values are NASA's; anything we fit ourselves is labelled as an estimate." },
];

export const SECTIONS = [
  { id: "cite", label: "How to cite" },
  { id: "cart", label: "Lab cart" },
  { id: "dictionary", label: "Data dictionary" },
  { id: "limitations", label: "Limitations" },
  { id: "publications", label: "Publications" },
  { id: "documents", label: "NASA documents" },
] as const;
