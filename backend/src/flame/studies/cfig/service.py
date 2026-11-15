"""Логіка карти режимів PSI-159. Числа беремо з `cfig.tests`; `cool_flame` — похідне."""

from typing import Any

from duckdb import DuckDBPyConnection

from flame.core.citations import doi_url
from flame.studies.cfig import repository as repo
from flame.studies.cfig.schemas import About, Facts, RegimeMap, RegimeTest

ACCESSION = "PSI-159"


class StudyDataMissing(LookupError):
    """У БД немає знімка ACME CFI-G (не зібрано build_db)."""


def cool_flame(note: str | None) -> bool | None:
    """Колонка "Cool flame?" таблиці: "yes, PCI-D" → True, "no, PCI-hot" → False, порожньо → None.

    Порожньо означає, що колонки для цього тесту нема (inverse-таблиця її не має) або її не
    заповнено, а не «холодного полум'я не було».
    """
    text = (note or "").strip().lower()
    if text.startswith("yes"):
        return True
    if text.startswith("no"):
        return False
    return None


def _test(row: dict[str, Any]) -> RegimeTest:
    note = (row["cool_flame_note"] or "").strip() or None
    return RegimeTest(
        test_id=row["test_id"],
        flame_type=row["flame_type"],
        fuel=row["fuel"],
        p_bar=row["p_bar"],
        x_o2=row["x_o2"],
        x_o2_after=row["x_o2_after"],
        fuel_flow_mg_s=row["fuel_flow_mg_s"],
        tad_k=row["tad_k"],
        zst=row["zst"],
        hot_ignition=row["hot_ignition"],
        burn_time_s=row["burn_time_s"],
        end_mode=row["end_mode"] or None,
        peak_burner_t_c=row["peak_burner_t_c"],
        cool_flame=cool_flame(note),
        cool_flame_note=note,
        comment=(row["comment"] or "").strip() or None,
        has_telemetry=bool(row["has_telemetry_ts"]),
    )


def get_regime_map(cur: DuckDBPyConnection) -> RegimeMap:
    about = repo.get_about(cur)
    if not repo.is_loaded(cur) or about is None:
        raise StudyDataMissing(ACCESSION)
    tests = [_test(r) for r in repo.list_tests(cur)]
    doi = about.get("doi", "")
    return RegimeMap(
        about=About(
            accession=ACCESSION,
            acronym=about.get("investigationAcronym") or "CFI-G",
            title=about.get("title", ""),
            doi=doi,
            doi_url=doi_url(doi),
            license=about.get("licenseIdentifier", ""),
            version=about.get("version"),
            citation=f"NASA Physical Sciences Informatics, {ACCESSION}, doi:{doi}",
        ),
        facts=Facts(
            n_tests=len(tests),
            n_normal=sum(t.flame_type == "normal" for t in tests),
            n_inverse=sum(t.flame_type == "inverse" for t in tests),
            fuels=sorted({t.fuel for t in tests}),
            n_self_extinguished=sum(t.end_mode == "self_extinguished" for t in tests),
            n_flow_terminated=sum(t.end_mode == "flow_terminated" for t in tests),
            n_cool_flame_noted=sum(t.cool_flame is True for t in tests),
        ),
        tests=tests,
    )
