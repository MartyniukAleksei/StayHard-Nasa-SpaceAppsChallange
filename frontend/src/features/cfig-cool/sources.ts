// Literature behind the callouts. Each callout cites these by id with [[id]] markers (see Cited.tsx).
// Bibliographic details (authors, venue, pages, DOI) were checked against Crossref / NASA NTRS;
// the numbers quoted in the callouts are the project team's reading of these papers.

export interface Source {
  id: string;
  /** how it reads inline: "Kim et al. 2023" */
  short: string;
  citation: string;
  href?: string;
  /** shown for sources we have no link for yet */
  todo?: string;
}

const doi = (d: string) => `https://doi.org/${d}`;

export const SOURCES: Record<string, Source> = {
  kim2023: {
    id: "kim2023",
    short: "Kim et al. 2023",
    citation:
      "Kim, M., Waddell, K. A., Sunderland, P., Nayagam, V., Stocker, D., Dietrich, D., Ju, Y., Williams, F., Irace, P., Axelbaum, R. (2023). Spherical gas-fueled cool diffusion flames. Proc. Combust. Inst. 39(2), 1647–1656.",
    href: doi("10.1016/j.proci.2022.07.015"),
  },
  irace2023: {
    id: "irace2023",
    short: "Irace et al. 2023",
    citation:
      "Irace, P., Waddell, K. A., Constales, D., Kim, M., Yablonsky, G., Sunderland, P., Axelbaum, R. (2023). On the existence of steady-state gaseous microgravity spherical diffusion flames in the presence of radiation heat loss. Proc. Combust. Inst. 39(2), 1721–1729.",
    href: doi("10.1016/j.proci.2022.07.049"),
  },
  waddell2023: {
    id: "waddell2023",
    short: "Waddell et al. 2023",
    citation:
      "Waddell, K. A., Lee, H.-J., Nayagam, V., Axelbaum, R., Sunderland, P. (2023). Cool diffusion flames in a stably stratified stagnation flow. Combust. Flame 254, 112852.",
    href: doi("10.1016/j.combustflame.2023.112852"),
  },
  waddell2024: {
    id: "waddell2024",
    short: "Waddell et al. 2024",
    citation:
      "Waddell, K. A., Dietrich, D. L., Nayagam, V. (2024). The Effects of Pressure and Optical Thickness on Radiative Losses in Spherical Diffusion Flames in Microgravity. NASA NTRS 20240003229.",
    href: "https://ntrs.nasa.gov/citations/20240003229",
  },
  ahmed2024: {
    id: "ahmed2024",
    short: "Ahmed 2024",
    citation: "Ahmed (2024). Multidimensional Simulation of Cool Diffusion Flame. Master's thesis, University of Southern California.",
    todo: "add a link to the thesis",
  },
  stocker2022: {
    id: "stocker2022",
    short: "Stocker 2022",
    citation:
      "Stocker, D. P. (2022). Laminar Non-Premixed Flames of Gaseous Fuel Aboard the International Space Station (ACME poster PS-01374). NASA NTRS 20220007191.",
    href: "https://ntrs.nasa.gov/citations/20220007191",
  },
  iss_reports: {
    id: "iss_reports",
    short: "NASA / ISS National Lab reports 2021–2023",
    citation: "NASA and ISS National Laboratory project reports, 2021–2023 (ACME / CFI-G).",
    todo: "add links to the individual NASA / ISS National Lab reports",
  },
};
