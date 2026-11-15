"""Що треба знати про дані кожного дослідження (docs/data/psi-studies.md §4) і які колонки
показувати за замовчуванням. Тексти англійською: вони йдуть агенту й в API."""

# Колонки `<slug>.tests`, що описують тест коротко (решта — за запитом або в get_test).
DEFAULT_COLUMNS: dict[str, list[str]] = {
    "cfi": ["test_no", "test_date", "fuel", "p_atm", "x_o2", "diluent", "fiber", "d0_mm",
            "k_hot_mm2_s", "k_cool_mm2_s", "reignitions"],
    "cfig": ["test_id", "flame_type", "fuel", "p_bar", "x_o2", "x_fuel", "hot_ignition",
             "flash_ignition", "burn_time_s", "end_mode"],
    "bass2": ["test_id", "pi", "test_date", "material", "flow_restrictor", "fan_display",
              "o2_initial_pct", "o2_final_pct"],
    "samer": ["test_id", "run_no", "aged_repeat", "sample_type", "test_date",
              "inlet_velocity_cm_s", "duration_s", "net_aging_s"],
    "saffire2": ["test_id", "material", "thickness_mm", "flow_direction", "air_flow_cm_s",
                 "o2_pct", "burn_time_s", "ug_spread_raw", "g1_spread_rate_raw"],
}  # fmt: skip

NOTES: dict[str, list[str]] = {
    "cfi": [
        "CFI (Cool Flames Investigation) burned single liquid-fuel droplets (dodecane, "
        "dodecane/isododecane mixtures, farnesane) in the CIR/MDCA on the ISS, the same "
        "apparatus as FLEX; test numbers continue the FLEX numbering.",
        "The main topic is cool flames: after the hot flame goes out, the droplet can keep "
        "burning at low temperature. k_hot_mm2_s and k_cool_mm2_s are the burning-rate "
        "constants of the hot and the cool flame from the science team's summary.",
        "Droplets on a fiber (fiber = true) and free-floating droplets (fiber = false) are "
        "different classes and must not be mixed; fiber is not recorded (NULL) for some tests, "
        "including all farnesane tests.",
        "Farnesane tests have no initial diameter or burning-rate constants.",
        "Columns starting with ts_ come from the per-test TestSheet; in_psi_table marks tests "
        "that also appear in the PSI experimental table.",
        "Test 1411 has the date 2011-09-06 in the source, although its CIR ID suggests "
        "2017-09-06; the table keeps the source value.",
    ],
    "cfig": [
        "ACME CFI-G burned gaseous fuels (ethane, propane, butane) on a porous spherical "
        "burner in the CIR on the ISS. flame_type normal: fuel flows into the oxidizer; "
        "inverse: oxidizer flows into the fuel.",
        "tad_k (adiabatic flame temperature) and zst (stoichiometric mixture fraction) are "
        "values computed by the science team, not measurements.",
        "end_mode tells how the burn ended: self_extinguished or flow_terminated; it is empty "
        "when the source does not say.",
        "ts_telemetry is 5 Hz telemetry; t_s counts from ignition (t0_ref). Some channels "
        "are raw voltages, not physical units; converting them is our own estimate (the "
        "calibration is in the Engineering Implementation Report).",
    ],
    "bass2": [
        "BASS-II burned solid samples (PMMA films, slabs and rods, Nomex, SIBAL) in a flow "
        "of air in the Microgravity Science Glovebox on the ISS.",
        "The letter in test_id names the science team: B Bhattacharjee, F Ferkul, M Miller, "
        "O Olson, P Fernandez-Pello, T T'ien.",
        "There are no time series in PSI for BASS-II. Fan and air settings are free text and "
        "often describe a sequence of changes during the test.",
        "Gas readings (O2, CO2, CO) are given at the start and the end of the test.",
    ],
    "samer": [
        "SAME-R tested smoke detectors: samples (Kapton, silicone, Pyrell, Teflon, cotton "
        "wick) were overheated on the ISS, the smoke was aged and measured by several "
        "detector types.",
        "Tests 51 and 51a share one run (run_no 51); the 'a' test is the measurement after "
        "the smoke aged (aged_repeat = true). The sensor series is per run, so both tests "
        "point to the same series. Run 51 has no sensor file.",
        "Ion A/B and ISS obscuration/scatter detector readings and STS are voltages; P-Trak "
        "counts particles per cm3, DustTrak A/B gives mg/m3.",
        "The year (2010) is taken from the file names; the source table has no year.",
    ],
    "saffire2": [
        "Saffire-II burned nine large samples (2-1 ... 2-9) inside the Cygnus cargo vehicle "
        "after it left the ISS (2016): silicone of different thickness, SIBAL, PMMA with "
        "Nomex and thick PMMA.",
        "Columns ending in _raw keep the source text with its notes; the numeric column next "
        "to it is filled only when the value is unambiguous.",
        "An empty material in the source means 'same as above' (material_filled_down = true). "
        "The oxygen value was derived from the measured CO2 (note 1 of the PSI table).",
        "ts_sensors is 1 Hz data in physical units; the samples burned one after another and "
        "each series covers its own time interval.",
    ],
}
