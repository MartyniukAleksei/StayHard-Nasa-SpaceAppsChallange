// Sources cited on the SAME-R overview. `short` is the link text next to a claim; `full` is the entry in References.
// Checked: the papers against Crossref/OpenAlex (DOI) or NTRS; the Final Report is read from the PSI-101 snapshot
// (pp. 4–5). Each text on the page says only what the abstract or the read pages support.

export type Ref = { id: string; short: string; full: string; href: string };

export const REFS: Record<string, Ref> = {
  fr: {
    id: "fr",
    short: "SAME-R Final Report 2014",
    full: "Urban, D.L., Ruff, G.A., Sheredy, W., Meyer, M., Cleary, T., Yang, J., Mulholland, G., Yuan, Z.-G. (2014). Smoke Aerosol Measurement Experiment Re-flight (SAMER): Final Report. NASA Glenn Research Center. File “SAME-R_Final Report.pdf” in the PSI-101 dataset.",
    href: "https://doi.org/10.60555/2np7-jv14",
  },
  urban07: {
    id: "urban07",
    short: "Urban et al. 2007 (NTRS)",
    full: "Urban, D.L., Ruff, G., Yuan, Z., Sheredy, W., Funk, G. (2007). Particle and smoke detection on ISS for next generation smoke detectors. NASA Technical Reports Server 20070031686.",
    href: "https://ntrs.nasa.gov/citations/20070031686",
  },
  meyer13: {
    id: "meyer13",
    short: "Meyer et al. 2013",
    full: "Meyer, M.E., Urban, D.L., Ruff, G.A., Mulholland, G., Yuan, Z.-G., Bryg, V., Cleary, T., Yang, J. (2013). Smoke Aerosol Measurement Experiment-2: comparison of flight experiment results with ground test results. 43rd International Conference on Environmental Systems, AIAA 2013-3433.",
    href: "https://doi.org/10.2514/6.2013-3433",
  },
  meyer15: {
    id: "meyer15",
    short: "Meyer et al. 2015",
    full: "Meyer, M.E., Mulholland, G.W., Bryg, V., Urban, D.L., Yuan, Z.-G., Ruff, G.A., Cleary, T., Yang, J. (2015). Smoke characterization and feasibility of the moment method for spacecraft fire detection. Aerosol Sci. Technol. 49, 299–309.",
    href: "https://doi.org/10.1080/02786826.2015.1025124",
  },
  psi101: {
    id: "psi101",
    short: "PSI-101 dataset",
    full: "NASA Physical Sciences Informatics. Smoke Aerosol Measurement Experiment-Reflight (SAME-R), PSI-101. Public domain (CC0).",
    href: "https://doi.org/10.60555/2np7-jv14",
  },
};
