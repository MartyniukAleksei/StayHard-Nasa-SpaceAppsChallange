"""Каталог полів таблиці `tests`: що можна фільтрувати/сортувати, типи, одиниці, опис.

Це whitelist: SQL-ідентифікатори в repository беруться лише звідси, а агент бачить цей
каталог як опис можливостей `query_tests` (без text-to-SQL).
"""

from typing import Literal

from pydantic import BaseModel

FieldType = Literal["number", "text", "bool", "date"]


class FieldInfo(BaseModel):
    name: str
    type: FieldType
    unit: str | None = None
    description: str
    values: list[str] | None = None  # допустимі значення для text-enum


def _f(name: str, type_: FieldType, description: str, unit: str | None = None, values=None):
    return FieldInfo(name=name, type=type_, unit=unit, description=description, values=values)


FIELDS: dict[str, FieldInfo] = {
    f.name: f
    for f in [
        _f("test_no", "number", "FLEX test number (FLEX-NNN)"),
        _f("cir_id", "text", "CIR test point id, e.g. 20CAL10"),
        _f("test_date", "date", "Date the test ran on the ISS"),
        _f("fuel", "text", "Droplet fuel", values=["Heptane", "Methanol"]),
        _f("p_atm", "number", "Ambient pressure", "atm"),
        _f("x_o2", "number", "O2 mole fraction", "mole fraction"),
        _f("x_n2", "number", "N2 mole fraction", "mole fraction"),
        _f("x_co2", "number", "CO2 mole fraction", "mole fraction"),
        _f("x_he", "number", "He mole fraction", "mole fraction"),
        _f("diluent", "text", "Main inert diluent", values=["N2", "CO2", "He"]),
        _f("d0_mm", "number", "Initial droplet diameter", "mm"),
        _f("dext_mm", "number", "Droplet diameter at flame extinction", "mm"),
        _f("k_mm2_s", "number", "Burning rate constant K from the NASA table", "mm²/s"),
        _f("burn_time_s", "number", "Burn time", "s"),
        _f(
            "end_type",
            "text",
            "How the test ended. Disruption = self-extinction not observed "
            "(never 'would burn forever')",
            values=["Extinction", "Completion", "Disruption"],
        ),
        _f("ts_fiber", "bool", "Droplet supported on a fiber (do not mix with free droplets)"),
        _f("ts_temperature_k", "number", "Ambient temperature from the TestSheet", "K"),
        _f("has_droplet_ts", "bool", "Droplet diameter time series available"),
        _f("has_flame_color_ts", "bool", "Color-camera flame time series available"),
        _f("has_flame_uv_ts", "bool", "UV-camera (OH*) flame time series available"),
        _f("has_chamber_ts", "bool", "Chamber pressure/temperature telemetry available"),
        _f("has_summary_pdf", "bool", "NASA summary PDF available"),
        _f("n_videos", "number", "Number of onboard videos for the test"),
    ]
}

SUMMARY_COLUMNS = [
    "test_no", "cir_id", "test_date", "fuel", "p_atm", "x_o2", "x_n2", "x_co2", "x_he",
    "diluent", "d0_mm", "dext_mm", "k_mm2_s", "burn_time_s", "end_type", "ts_fiber",
    "has_droplet_ts", "has_flame_color_ts", "has_flame_uv_ts", "n_videos",
]  # fmt: skip

# Обчислювані колонки зведення. fiber_conflict: TestSheet каже «Fiber: No», а коментар
# дослідника описує краплю на нитці (8 тестів у FLEX v1) — тип краплі неоднозначний.
FIBER_CONFLICT_SQL = (
    "coalesce(NOT ts_fiber AND regexp_matches(ts_comment, '(?i)fi?ber[- ]supported'), false)"
)

# Часові ряди: сигнал → (таблиця, колонки, файл-джерело в raw/NNN або None)
SIGNALS: dict[str, tuple[str, list[str], str | None]] = {
    "droplet": ("ts_droplet", ["t_s", "d_mm", "x_mm", "y_mm"], "DropletData.txt"),
    "flame_color": ("ts_flame_color", ["t_s", "flame_d_mm", "standoff"], "ColorCamData.txt"),
    "flame_uv": (
        "ts_flame_uv",
        ["t_s", "flame_d_mm", "standoff", "droplet_x_mm", "droplet_z_mm"],
        "LLUVData.txt",
    ),
    "chamber": ("ts_chamber", ["timestamp", "p_psia", "T1_C", "T2_C", "T3_C", "T4_C"], None),
}

# Ознаки близькості умов для «сусідніх» тестів (відстань у z-score)
NEIGHBOR_FEATURES = ["p_atm", "x_o2", "x_co2", "x_he", "d0_mm"]
