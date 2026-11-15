"""Ключові числа звіту BASS-II (NASA/TM-20210011385) з номерами сторінок.

Це не дані БД, а висновки авторів звіту, перевірені вручну по тексту (сторінка = друкована
сторінка звіту; у PDF вона на 8 далі). Кожне число йде на сторінку з посиланням-джерелом.
"""

from dataclasses import dataclass

REPORT_FILE = "docs/Reports/Reports_BASS-II Summary Report.pdf"
REPORT_TITLE = "NASA/TM-20210011385, BASS-II Summary Report (2021)"
PAGE_OFFSET = 8


@dataclass(frozen=True)
class Finding:
    id: str
    group: str  # earth_vs_space | flammability | extinction | products | crew
    title: str
    value: str  # як у звіті, з одиницями
    earth_value: str | None  # порівняння з Землею, якщо є у звіті
    text: str  # дослівно або близько до тексту звіту
    page: int  # друкована сторінка
    figure: str | None = None


FINDINGS: tuple[Finding, ...] = (
    Finding(
        "rod_min_o2",
        "earth_vs_space",
        "PMMA rods burn at lower O₂ in space",
        "13.5% O₂",
        "15.4% O₂",
        "The minimum O2 concentration of 13.5 percent O2 at a of 8 to 12 s-1 is significantly "
        "lower than the observed upward flame spread limit of 15.4 percent O2 (in normal gravity "
        "with an additional 4-cm/s forced flow), indicating the material remains flammable "
        "under the weak ventilation only obtainable in microgravity.",
        76,
        "Fig. 6.10",
    ),
    Finding(
        "opposed_rod_min_o2",
        "earth_vs_space",
        "Opposed-flow spread over rods at lower O₂ in space",
        "17.5% O₂",
        "19% O₂",
        "While in microgravity, flame spread was observed at O2 concentrations as low as 17.5 "
        "percent, in normal gravity, flame spread was not observed below 19 percent.",
        50,
        "Fig. 4.3",
    ),
    Finding(
        "boundary_eq",
        "flammability",
        "U-shaped flammability boundary for PMMA rods",
        "X_O2 = 6·exp(−0.5·a) + 0.0167·a + 13.4",
        None,
        "The O2 concentration versus stretch rate a boundary is defined by the combined "
        "empirical equations: quenching branch (exponential) and blowoff branch (linear). "
        "a = (3/2)(U/r)(r/r0)^1/2, r0 = 0.318 cm.",
        75,
        "Fig. 6.9, Eq. (6.1)",
    ),
    Finding(
        "ignition_limit",
        "flammability",
        "Harder to ignite than to keep burning",
        "~14.5% O₂ to ignite, 13.6% O₂ to survive",
        None,
        "All values fall below the ignition limit of ~14.5 percent O2. Despite this limiting O2 "
        "concentration for ignition, flames ignited at a higher O2 survived to final O2 "
        "concentrations as low as 13.6 percent O2.",
        68,
        "Fig. 6.2",
    ),
    Finding(
        "ignition_delay",
        "earth_vs_space",
        "Ignition can take far longer than the standard test allows",
        "up to 230 s",
        "~25 s (NASA Test 1)",
        "NASA's Test 1 is an upward flame spread test that has a fixed ignition time of ~25 s. "
        "Successful ignitions occur with ignition delay times as long as 230 s. NASA Test 1 "
        "25-s ignition time may be too short for flammability test.",
        69,
        "Fig. 6.2",
    ),
    Finding(
        "pre_quench_oscillation",
        "extinction",
        "Flames oscillate before they go out",
        "1.1 Hz",
        None,
        "The radiometer signal oscillates at approximately 1.1 Hz and drops over a period of a "
        "few seconds followed by a large oscillation.",
        72,
        "Fig. 6.6",
    ),
    Finding(
        "film_quench_velocity",
        "extinction",
        "Thin films: critical flow for radiative extinction",
        "~1 cm/s (100–300 µm), ~1.5 cm/s (400 µm) at 21% O₂",
        None,
        "When tests are repeated with samples of different thicknesses, the extinction "
        "velocities are found to be about 1 cm/s for 100, 200, and 300 µm and about 1.5 cm/s "
        "for 400 µm.",
        13,
        "Fig. 2.1–2.2",
    ),
    Finding(
        "film_quench_low_o2",
        "extinction",
        "Less oxygen needs more flow to survive",
        "2.6 cm/s (100 µm), 4 cm/s (200 µm) at ~16% O₂",
        None,
        "At a lower O2 level of about 16 percent the extinction velocities were found to be "
        "about 2.6 cm/s for 100 µm and about 4 cm/s for 200 µm (sample widths differed: 20 "
        "and 10 mm).",
        15,
        None,
    ),
    Finding(
        "fabric_quench",
        "extinction",
        "Fabric: first clean low-speed quenching boundary in concurrent flow",
        "1–5 cm/s",
        None,
        "The quenching speeds were found to be between 1 and 5 cm/s with higher speed in lower "
        "O2 atmosphere.",
        93,
        "Table 7.1",
    ),
    Finding(
        "rod_min_flow",
        "extinction",
        "No sustained opposed spread over rods without flow",
        "below ~4 mm/s",
        "~50 cm/s buoyant flow on Earth",
        "Sustained flame spread was not observed for opposed-flow velocities below approximately "
        "4 mm/s for the 6.35- and 9.525-mm-diameter rods. The characteristic buoyant velocity "
        "is approximately 0.50 m/s, an order of magnitude greater than the largest forced flow.",
        48,
        None,
    ),
    Finding(
        "nomex",
        "flammability",
        "Nomex III did not ignite",
        "0 of 3 samples",
        None,
        "The three Nomex samples did not ignite, which is an excellent result for fire safety "
        "aboard the ISS.",
        46,
        None,
    ),
    Finding(
        "co_per_co2",
        "products",
        "Carbon monoxide depends on geometry",
        "~550 ppm CO per 1% CO₂ (concurrent rods), ~370 (opposed slabs)",
        None,
        "The concurrent rods produced on average 550 ppm of CO for every 1 percent of CO2. "
        "The opposed thick slabs produce on average 370 ppm of CO for every 1 percent of CO2.",
        7,
        "Fig. 1.4",
    ),
    Finding(
        "co_ratio",
        "products",
        "Microgravity flames burn inefficiently",
        "CO/CO₂ ≫ 0.004",
        None,
        "For efficiently burned flue gases this ratio is typically less than 0.004. Most of our "
        "data is well above that, indicating that microgravity flames are comparatively "
        "inefficient.",
        8,
        "Fig. 1.5",
    ),
    Finding(
        "heat_release",
        "products",
        "Small fires: heat release",
        "typically ≪ 100 W",
        None,
        "Using Huggett's constant of 13.1 kJ/g O2, we estimate the HRRs to be typically well "
        "below 100 W. The one long opposed thick slab test that caused window damage released "
        "close to 100 W.",
        8,
        "Fig. 1.6",
    ),
    Finding(
        "equivalence_ratio",
        "products",
        "Flames are fuel rich",
        "Φ ≈ 1.3",
        None,
        "The global equivalence ratio for the tests is estimated to be fuel rich, 1.3 on average "
        "using mass loss and O2 consumption data.",
        2,
        None,
    ),
    Finding(
        "station_scale",
        "products",
        "Diluted in the U.S. Lab, CO stays below limits",
        "~1.5 ppm CO",
        None,
        "Even within just the U.S. Lab (106-m3 pressurized volume), the CO levels would only be "
        "1.5 ppm, well below SMAC values for even long-term exposure (10 ppm), let alone the "
        "1 hour SMAC of 55 ppm.",
        8,
        None,
    ),
    Finding(
        "keep_suppressing",
        "crew",
        "Keep suppressing until the material cools",
        "—",
        None,
        "Spacecraft fire suppression efforts should be maintained until the burning material "
        "has cooled and stopped emitting vapors.",
        52,
        None,
    ),
    Finding(
        "molten_droplets",
        "crew",
        "Melting materials can shed burning droplets",
        "—",
        None,
        "The ejected wax droplet typifies the flame spread hazard associated with melting "
        "plastics in microgravity. Burning droplets can be ejected and possibly ignite other "
        "materials.",
        46,
        "Fig. 3.1",
    ),
)
