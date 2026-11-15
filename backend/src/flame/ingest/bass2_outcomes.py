"""Ручна розмітка результату кожного тесту BASS-II (наше прочитання тексту, *derived*).

Джерело: спостереження з Додатку A звіту NASA/TM-20210011385 (с. 103–113), а де PI
опублікував власну таблицю — його вердикт (табл. 7.1 T'ien, с. 96). Доказ — сам текст
`observations`, що йде поруч у appendix_a.json.

outcome:
  no_ignition  запалювали, але стійкого полум'я не було
  quench       згасло саме при слабкому чи скінченному потоці (зокрема під час зменшення потоку)
  blowoff      зірвано сильним потоком
  flow_off     екіпаж вимкнув вентилятор, щоб загасити
  burnout      полум'я пройшло весь зразок
  sustained    горіло до кінця тесту, шукану межу не досягнуто
  unknown      у тексті не сказано, чим закінчився тест

confidence: high — явно в тексті або в таблиці PI; medium — наше прочитання неоднозначного тексту.
"""

# test_id: (outcome, confidence, note)
OUTCOMES = {
    # Bhattacharjee, thin PMMA films, opposed flow (Table A.1)
    "B1": ("flow_off", "high", "turned flow off after spread halfway, extinguished very quickly"),
    "B2": ("unknown", "high", "no stills, cable came loose"),
    "B3": ("unknown", "high", ""),
    "B4": ("unknown", "high", ""),
    "B5": ("unknown", "high", ""),
    "B6": ("burnout", "high", "complete burnout"),
    "B7": ("unknown", "high", ""),
    "B8": ("sustained", "high", "spread at 10 cm/s, did not blow off"),
    "B9": ("quench", "high", "extinguished at pot 0.35"),
    "B10": ("quench", "high", "extinguished at pot 0.35"),
    "B11": ("quench", "high", "extinguished at pot 0.35"),
    "B12": ("unknown", "high", ""),
    "B13": ("quench", "high", "extinguished at pot 0.35"),
    "B14": ("no_ignition", "high", "only brief ignition"),
    "B15": ("sustained", "high", "spread at 10 cm/s, did not blow off"),
    "B16": ("quench", "high", "quenched after prolonged burn at pot 0.4"),
    "B17": ("quench", "high", "extinguished at pot 0.4"),
    "B18": ("blowoff", "high", "blew out at fan pot 7.0"),
    "B19": ("blowoff", "high", "blew out at pot 6.0"),
    "B20": ("burnout", "high", "burned entire sample"),
    "B21": ("quench", "high", "out at pot 0.355"),
    "B22": ("quench", "high", "out at pot 0.36"),
    # Ferkul, Nomex III and wax candle (Table A.2)
    "F1": ("no_ignition", "high", "extinguished while igniter still on"),
    "F2": ("no_ignition", "high", "flame would not sustain"),
    "F3": ("no_ignition", "high", "brief flash, no sustained flame"),
    "F4": ("quench", "high", "candle, flow reduced in steps, out at pot 0.305"),
    # Fernandez-Pello, black/clear rods, opposed flow (Table A.3)
    "P1": ("quench", "high", "extinction at pot 0.315 (finite low flow)"),
    "P2": ("flow_off", "high", "just fan off, not slow ramp"),
    "P3a": ("quench", "high", "extinguished at pot 0.3"),
    "P3b": ("unknown", "high", "camera power failure"),
    "P4": ("flow_off", "high", "steady until turned off flow"),
    "P5": ("flow_off", "high", "flame persisted at all pots, turned flow to 0 to extinguish"),
    "P6": ("flow_off", "high", "steady burning until turned flow off"),
    "P8": ("no_ignition", "high", "would not stay lit"),
    "P9": ("quench", "high", "out at pot 0.28"),
    "P10": ("quench", "high", "finite quench at pot 0.3"),
    "P12": ("quench", "high", "oscillating at 0.36, out at 0.34"),
    "P13a": ("flow_off", "high", "flame out when pot turned to 0"),
    "P13b": ("quench", "high", "out at pot 0.32"),
    "P14": ("quench", "high", "extinguished at 0.31"),
    "P15": ("unknown", "medium", "stable burn, end not stated"),
    "P16": ("quench", "high", "extinguished at pot 0.32"),
    "P17": ("quench", "high", "blowoff tried without success, out at 0.34"),
    "P18": ("quench", "high", "extinction at fan pot 0.32"),
    "P19": ("quench", "high", "no blowoff at pot 10, out at 0.32"),
    "P20": ("quench", "high", "extinction at fan pot 0.335"),
    "P21a": ("quench", "medium", "self-extinguished at constant 5 cm/s after rod end became flat"),
    "P21b": ("no_ignition", "high", "igniter broke on third attempt"),
    "P22a": ("quench", "high", "extinguished at higher flow than P22b"),
    "P22b": ("quench", "high", "extinguished at lower flow than P22a"),
    "P23": ("quench", "high", "extinction at fan pot 0.38"),
    "P24": ("quench", "high", "extinction at fan pot 0.30"),
    "P25": ("quench", "high", "extinguished at pot 0.31"),
    # Miller, thick PMMA slabs, opposed flow (Table A.4; Table 5.1 p.57 velocities)
    "M1": ("flow_off", "high", "ran out of camera card, put flame out by turning off flow"),
    "M2": ("quench", "high", "self-extinguished after flow reduced to 13-14 cm/s"),
    "M3": ("quench", "high", "extinguished at 18 cm/s"),
    "M4": ("quench", "medium", "extinguished by turning pot down to 0.3"),
    "M5": ("quench", "high", "extinguished at 5 cm/s after prolonged flashing"),
    "M6": ("burnout", "medium", "flame reached end of sample"),
    "M7": ("burnout", "high", "burned entire sample"),
    "M8": ("quench", "high", "turned down flow, out at pot 0.4"),
    "M9": ("quench", "high", "died after 15 min at 14 cm/s"),
    "M10": ("quench", "high", "self-extinguished at 8 cm/s"),
    "M11": ("quench", "high", "extinguished at 12 cm/s"),
    "M12": ("unknown", "high", ""),
    "M13": ("quench", "medium", "extinguished by turning pot down to 0.3"),
    "M14": ("quench", "high", "self-extinguished at air reading 9 cm/s"),
    "M15": ("quench", "high", "slow extinction at 15 cm/s"),
    "M16": ("burnout", "medium", "burned to end of sample"),
    "M17": ("flow_off", "high", "turned fan pot to 0 to extinguish"),
    "M18": ("quench", "high", "extinguished at 8 cm/s"),
    "M19": ("quench", "high", "went out on its own at 5 cm/s"),
    "M20": ("quench", "high", "out 3 min after flow reduced to 8 cm/s"),
    # Olson, rods, concurrent / stagnation (Table A.5)
    "O1": ("unknown", "high", "rod broken off holder by crew"),
    "O2": ("unknown", "high", ""),
    "O3a": ("quench", "high", "extinguished as soon as flow was turned down"),
    "O3b": ("unknown", "high", ""),
    "O4": ("quench", "high", "extinguished at 0.36"),
    "O5a": ("blowoff", "high", "blew out at pot 4.0 after oscillations"),
    "O5b": ("no_ignition", "high", "would not sustain without igniter"),
    "O6": ("unknown", "high", "no observations"),
    "O7": ("blowoff", "high", "blowoff fan 97"),
    "O8a": ("quench", "high", "quench at pot 0.31"),
    "O8b": ("blowoff", "high", "blowoff fan 78"),
    "O9": ("blowoff", "high", "blowoff fan 68"),
    "O10": ("blowoff", "high", "leading edge blew out at fan 81, rest at max flow"),
    "O11": ("blowoff", "high", "blowoff at pot 6.0"),
    "O12": ("no_ignition", "high", "no sustained flame at any flow"),
    "O13a": ("quench", "high", "self-extinguished after 3+ min at pot 0.31"),
    "O13b": ("quench", "medium", "reburn, stayed lit at 0.9 for less than a minute"),
    "O14": ("quench", "high", "quenching pot 0.28"),
    "O15a": ("quench", "high", "extinction at 0.32 pot"),
    "O15b": ("quench", "high", "extinction at 0.27 pot"),
    "O16": ("no_ignition", "high", "no sustained flame"),
    "O17": ("blowoff", "high", "LE blowoff at fan 72, did not recover"),
    "O18": ("blowoff", "medium", "stagnation region blew out, did not restabilize"),
    "O19": ("quench", "high", "quenching pot 0.288"),
    # T'ien, SIBAL fabric / PMMA sphere, concurrent (Table A.6; Table 7.1 p.96 is authoritative)
    "T1": ("unknown", "high", "Table 7.1: no comment"),
    "T2": ("unknown", "high", "Table 7.1: no comment"),
    "T3": ("no_ignition", "high", "brief flames go out (PMMA sphere)"),
    "T4": ("quench", "high", "Table 7.1: Quenched"),
    "T5": ("burnout", "medium", "seemed to burn full sample as a flamelet"),
    "T6": ("sustained", "high", "did not extinguish"),
    "T7": ("quench", "high", "PMMA sphere, extinction at pot 0.28"),
    "T9": ("no_ignition", "high", "Table 7.1: No ignition"),
    "T10": ("no_ignition", "high", "Table 7.1: No ignition"),
    "T11": ("burnout", "high", "burned completely"),
    "T12": ("no_ignition", "high", "Table 7.1: No ignition"),
    "T13": ("quench", "high", "Table 7.1: Quenched"),
    "T14": ("quench", "high", "Table 7.1: Quenched"),
    "T15": ("sustained", "high", "Table 7.1: No blowoff"),
    "T16": ("burnout", "high", "spread whole sample"),
    "T17": ("sustained", "high", "Table 7.1: No blowoff"),
    "T18": ("quench", "high", "Table 7.1: Quenched"),
    "T19": ("sustained", "medium", "steady burn"),
    "T20": ("quench", "high", "Table 7.1: Quenched"),
    "T21": ("blowoff", "high", "Table 7.1: Blow-off"),
    "T22": ("quench", "high", "Table 7.1: Quenched"),
    "T23": ("no_ignition", "high", "Table 7.1: Reused, did not ignite"),
    "T24": ("sustained", "medium", "Table 7.1: Reused, one-sided flame"),
    "T25": ("unknown", "high", "Table 7.1: Reused, ignited"),
    "T26": ("unknown", "high", "Table 7.1: Reused, ignited"),
    "T27": ("burnout", "high", "fuel is burned out; Table 7.1: Reused"),
    "T28a": ("no_ignition", "high", "Table 7.1: Reused, did not ignite"),
    "T28b": ("no_ignition", "high", "Table 7.1: Reused, did not ignite"),
    "T29": ("quench", "medium", "out after flow reduced; Table 7.1: Reused, ignited"),
}
# T'ien: reused samples give less quantitative data and are not discussed by the PI (p.95)
TIEN_REUSED = {"T23", "T24", "T25", "T26", "T27", "T28a", "T28b", "T29"}
# T1, T2, T4, T15 have "1" in the flow column of Table A.6;
# T'ien section 7 is all concurrent flow (p.93)
FLOW_FILL = {"T1": "Concurrent", "T2": "Concurrent", "T4": "Concurrent", "T15": "Concurrent"}
