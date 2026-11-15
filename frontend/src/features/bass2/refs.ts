// Sources cited on the BASS-II overview. `short` is the link text next to a claim; `full` is the entry in
// References. Every entry was checked against Crossref (DOI) or NASA NTRS on 2026-11-15.

export type Ref = { id: string; short: string; full: string; href: string };

export const REFS: Record<string, Ref> = {
  report: {
    id: "report",
    short: "BASS-II report 2021",
    full: "Olson, S.L., Ferkul, P.V., Bhattacharjee, S., Miller, F.J., Fernandez-Pello, C., Link, S., T'ien, J.S., Wichman, I. (2021). Burning and Suppression of Solids–II (BASS-II) Summary Report. NASA/TM-20210011385.",
    href: "https://ntrs.nasa.gov/citations/20210011385",
  },
  olson17: {
    id: "olson17",
    short: "Olson & Ferkul 2017",
    full: "Olson, S.L., Ferkul, P.V. (2017). Microgravity flammability boundary for PMMA rods in axial stagnation flow: experimental results and energy balance analyses. Combust. Flame 180, 217–229.",
    href: "https://doi.org/10.1016/j.combustflame.2017.03.001",
  },
  bhatt16cf: {
    id: "bhatt16cf",
    short: "Bhattacharjee et al. 2016a",
    full: "Bhattacharjee, S., Simsek, A., Olson, S., Ferkul, P. (2016). The critical flow velocity for radiative extinction in opposed-flow flame spread in a microgravity environment: a comparison of experimental, computational, and theoretical results. Combust. Flame 163, 472–477.",
    href: "https://doi.org/10.1016/j.combustflame.2015.10.023",
  },
  bhatt16fsj: {
    id: "bhatt16fsj",
    short: "Bhattacharjee et al. 2016b",
    full: "Bhattacharjee, S., Laue, M., Carmignani, L., Ferkul, P., Olson, S. (2016). Opposed-flow flame spread: a comparison of microgravity and normal gravity experiments to establish the thermal regime. Fire Saf. J. 79, 111–118.",
    href: "https://doi.org/10.1016/j.firesaf.2015.11.011",
  },
  zhao17: {
    id: "zhao17",
    short: "Zhao et al. 2017",
    full: "Zhao, X., Liao, Y.-T., Johnston, M., T'ien, J.S., Ferkul, P.V., Olson, S.L. (2017). Concurrent flame growth, spread, and quenching over composite fabric samples in low speed purely forced flow in microgravity. Proc. Combust. Inst. 36, 2971–2978.",
    href: "https://doi.org/10.1016/j.proci.2016.06.028",
  },
  link18: {
    id: "link18",
    short: "Link et al. 2018",
    full: "Link, S., Huang, X., Fernandez-Pello, C., Olson, S., Ferkul, P. (2018). The effect of gravity on flame spread over PMMA cylinders. Sci. Rep. 8, 120.",
    href: "https://doi.org/10.1038/s41598-017-18398-4",
  },
  psi25: {
    id: "psi25",
    short: "PSI-25 dataset",
    full: "NASA Physical Sciences Informatics. Burning and Suppression of Solids – II (BASS-II), PSI-25. Public domain (CC0).",
    href: "https://doi.org/10.60555/4qc4-de67",
  },
};
