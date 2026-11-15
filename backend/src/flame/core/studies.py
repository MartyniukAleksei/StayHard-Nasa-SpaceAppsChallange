"""Реєстр досліджень PSI, дані яких є в застосунку. Спільний для ingest, API, RAG і агента.

У `flame.duckdb` FLEX лежить у схемі `main` (і view у `flex`), а кожне інше дослідження —
у схемі з іменем `slug` (ADR 0008, docs/data/psi-studies.md).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Study:
    slug: str  # ім'я схеми в БД і сегмент шляху API
    accession: str  # PSI accession, напр. "PSI-39"
    acronym: str
    test_key: str  # ключ тесту в `<slug>.tests`
    series_key: str  # ключ тесту в `<slug>.ts_*` (у samer ряд прив'язаний до прогону)
    test_label: str  # як називати тест у тексті: "{acronym} test {id}"


FLEX = Study("flex", "PSI-69", "FLEX", "test_no", "test_no", "FLEX")

# Порядок = порядок у реєстрі БД і в описах інструментів агента.
PSI_STUDIES: dict[str, Study] = {
    s.slug: s
    for s in (
        Study("cfi", "PSI-39", "CFI", "test_no", "test_no", "CFI"),
        Study("cfig", "PSI-159", "ACME CFI-G", "test_id", "test_id", "CFI-G"),
        Study("bass2", "PSI-25", "BASS-II", "test_id", "test_id", "BASS-II"),
        Study("samer", "PSI-101", "SAME-R", "test_id", "run_no", "SAME-R"),
        Study("saffire2", "PSI-99", "Saffire-II", "test_id", "test_id", "Saffire-II"),
    )
}

ALL_STUDIES: dict[str, Study] = {FLEX.slug: FLEX, **PSI_STUDIES}
BY_ACCESSION: dict[str, Study] = {s.accession: s for s in ALL_STUDIES.values()}
