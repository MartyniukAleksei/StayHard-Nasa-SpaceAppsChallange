// Sources cited on the FLEX overview. `short` is the link text next to a claim; `full` is the entry in References.
// Every entry was checked against Crossref or NTRS; `href` opens the paper or the dataset.

export type Ref = { id: string; short: string; full: string; href: string };

export const REFS: Record<string, Ref> = {
  godsave: {
    id: "godsave",
    short: "Godsave 1953",
    full: "Godsave, G.A.E. (1953). Studies of the combustion of drops in a fuel spray: the burning of single drops of fuel. Proc. Combust. Inst. 4, 818–830.",
    href: "https://doi.org/10.1016/S0082-0784(53)80107-4",
  },
  spalding: {
    id: "spalding",
    short: "Spalding 1953",
    full: "Spalding, D.B. (1953). The combustion of liquid fuels. Proc. Combust. Inst. 4, 847–864.",
    href: "https://doi.org/10.1016/S0082-0784(53)80110-4",
  },
  dietrich: {
    id: "dietrich",
    short: "Dietrich et al. 2014",
    full: "Dietrich, D.L., Nayagam, V., Hicks, M.C., Ferkul, P.V., Dryer, F.L., Farouk, T., Shaw, B.D., Suh, H.K., Choi, M.Y., Liu, Y.C., Avedisian, C.T., Williams, F.A. (2014). Droplet combustion experiments aboard the International Space Station. Microgravity Sci. Technol. 26, 65–76.",
    href: "https://doi.org/10.1007/s12217-014-9372-2",
  },
  rasul: {
    id: "rasul",
    short: "Rasul et al. 2023",
    full: "Rasul, R.B., Avedisian, C.T., Xu, Y., Hicks, M.C., Reeves, A.P. (2023). Dynamic differential image circle diameter measurement precision assessment: application to burning droplets. IEEE Trans. Pattern Anal. Mach. Intell. 45, 1668–1681.",
    href: "https://doi.org/10.1109/TPAMI.2022.3170926",
  },
  nayagam12: {
    id: "nayagam12",
    short: "Nayagam et al. 2012",
    full: "Nayagam, V., Dietrich, D.L., Ferkul, P.V., Hicks, M.C., Williams, F.A. (2012). Can cool flames support quasi-steady alkane droplet burning? Combust. Flame 159, 3583–3588.",
    href: "https://doi.org/10.1016/j.combustflame.2012.07.012",
  },
  nayagam13: {
    id: "nayagam13",
    short: "Nayagam 2013",
    full: "Nayagam, V. (2013). Activation energy asymptotics for methanol droplet extinction in microgravity. Combust. Flame 160, 2638–2640.",
    href: "https://doi.org/10.1016/j.combustflame.2013.05.011",
  },
  nayagam14: {
    id: "nayagam14",
    short: "Nayagam et al. 2014 (NTRS)",
    full: "Nayagam, V., Dietrich, D.L., Hicks, M.C., Williams, F.A. (2014). Cool-flame extinction during n-alkane droplet combustion in microgravity. NASA Technical Reports Server 20140006750.",
    href: "https://ntrs.nasa.gov/citations/20140006750",
  },
  farouk11: {
    id: "farouk11",
    short: "Farouk & Dryer 2011",
    full: "Farouk, T., Dryer, F.L. (2011). Microgravity droplet combustion: effect of tethering fiber on burning rate and flame structure. Combust. Theory Model. 15, 487–515.",
    href: "https://doi.org/10.1080/13647830.2010.547601",
  },
  farouk: {
    id: "farouk",
    short: "Farouk & Dryer 2014",
    full: "Farouk, T.I., Dryer, F.L. (2014). Isolated n-heptane droplet combustion in microgravity: “cool flames”, two-stage combustion. Combust. Flame 161, 565–581.",
    href: "https://doi.org/10.1016/j.combustflame.2013.09.011",
  },
  psi69: {
    id: "psi69",
    short: "PSI-69 dataset",
    full: "NASA Physical Sciences Informatics. Flame Extinguishment Experiment (FLEX), PSI-69. Public domain (CC0).",
    href: "https://doi.org/10.60555/mbq8-0451",
  },
  ahmed: {
    id: "ahmed",
    short: "PSI-117 data (Ahmed 2024)",
    full: "Ahmed, E. (2024). Multidimensional simulation of cool diffusion flame. PhD dissertation, University of South Carolina. Data: NASA PSI-117.",
    href: "https://doi.org/10.60555/gz0q-b577",
  },
};
