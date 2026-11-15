"""Відповідь агента → сегменти з номерами джерел; пошук тверджень без цитат (ADR 0006).

Claude API повертає відповідь як текстові блоки; блоки, що спираються на `search_result`,
мають `citations` типу `search_result_location` з нашим `url` у полі `source`.
"""

import re
from typing import Any

from pydantic import BaseModel

from flame.agent.prompt import GENERAL_KNOWLEDGE_PREFIX

# Виміряне значення: десяткове число або число з одиницею — те, що вимагає джерела.
# Номери тестів (FLEX-019) самі по собі не факт: це заголовки й посилання.
_NUM_UNIT = re.compile(
    r"(?<![\w.-])(\d+(?:\.\d+)?)\s*(?:%|atm|mm²/s|mm2/s|mm|cm/s|cm\b|s\b|K\b|psia|°C|mmHg|bar\b|ppm|W\b|V\b|mg/s)"
)
_DECIMAL = re.compile(r"(?<![\w.-])(\d+\.\d+)(?!\w)")


_HEADING = re.compile(r"^(#{1,6} .*|\*\*[^*]+\*\*:?)$")


def numbers(text: str) -> set[float]:
    return {float(x) for rx in (_NUM_UNIT, _DECIMAL) for x in rx.findall(text)}


class AnswerSource(BaseModel):
    n: int
    url: str
    title: str
    quotes: list[str]  # дослівні cited_text, які модель використала


class Segment(BaseModel):
    text: str
    cites: list[int] = []
    general: bool = False  # абзац «General knowledge:»
    uncited: bool = False  # фактичне твердження без цитати → «No source» в UI


class Answer(BaseModel):
    segments: list[Segment]
    sources: list[AnswerSource]

    @property
    def text(self) -> str:
        return "".join(s.text for s in self.segments)

    def uncited_texts(self) -> list[str]:
        return [s.text.strip() for s in self.segments if s.uncited]


def _get(obj: Any, key: str) -> Any:
    return obj.get(key) if isinstance(obj, dict) else getattr(obj, key, None)


def build_answer(content: list[Any], question: str = "") -> Answer:
    """Текстові блоки одного повідомлення асистента → `Answer`.

    Числа, що є в самому питанні користувача, не вимагають цитати (це не нові факти).
    """
    sources: dict[str, AnswerSource] = {}
    segments: list[Segment] = []
    for block in content:
        if _get(block, "type") != "text":
            continue
        cites: list[int] = []
        for c in _get(block, "citations") or []:
            url = _get(c, "source")
            if _get(c, "type") != "search_result_location" or not url:
                continue
            src = sources.get(url)
            if src is None:
                src = sources[url] = AnswerSource(
                    n=len(sources) + 1, url=url, title=_get(c, "title") or url, quotes=[]
                )
            quote = (_get(c, "cited_text") or "").strip()
            if quote and quote not in src.quotes:
                src.quotes.append(quote)
            if src.n not in cites:
                cites.append(src.n)
        segments.append(Segment(text=_get(block, "text") or "", cites=cites))
    _mark(segments, numbers(question))
    return Answer(segments=segments, sources=sorted(sources.values(), key=lambda s: s.n))


def _mark(segments: list[Segment], known: set[float]) -> None:
    """Позначає `general` і `uncited`, проходячи текст по рядках.

    - Абзац, що починається з «General knowledge:», триває до порожнього рядка.
    - Рядок з фактом (число з одиницею або десяткове, не з питання) без жодної цитати й поза
      таким абзацом →
      його сегменти з фактами `uncited`. Перевіряємо по рядку, а не по блоку: API ділить
      речення на блоки, і заголовок пункту («FLEX-001:») часто окремий блок без цитати,
      хоча цитата стоїть далі в тому ж рядку.
    """
    in_general = False
    line: list[tuple[int, str]] = []  # (індекс сегмента, шматок тексту в цьому рядку)
    general_pieces: dict[int, list[bool]] = {}

    def flush() -> None:
        nonlocal in_general
        text = "".join(p for _, p in line).strip()
        if not text:
            in_general = False  # порожній рядок закриває абзац
        elif text.lstrip("*_# ").startswith(GENERAL_KNOWLEDGE_PREFIX):  # і «**General…:**»
            in_general = True
        for i, piece in line:
            if piece.strip():
                general_pieces.setdefault(i, []).append(in_general)
        heading = bool(_HEADING.match(text))  # «**About 0.7 atm**» — підпис групи, не факт
        if text and not in_general and not heading and not any(segments[i].cites for i, _ in line):
            for i, piece in line:
                if numbers(piece) - known:
                    segments[i].uncited = True
        line.clear()

    for i, seg in enumerate(segments):
        for j, piece in enumerate(seg.text.split("\n")):
            if j > 0:
                flush()
            line.append((i, piece))
    flush()
    for i, flags in general_pieces.items():
        segments[i].general = all(flags)


REWRITE_INSTRUCTION = (
    "Some statements in your answer contain facts or numbers about the experiments without a "
    "citation:\n"
    "{items}\n\nRewrite your complete answer. Cite every fact and number from the tool "
    "results (call a tool if you need the source), drop numbers you cannot cite, and put "
    f'background physics in a paragraph starting with "{GENERAL_KNOWLEDGE_PREFIX}".'
)


NO_CITATIONS_INSTRUCTION = (
    "Your final message has no citations, although the tools returned sources. Write your "
    "complete answer again in one final message, citing the tool results for every fact and "
    "number about the experiments. Do not call tools you already called."
)


def rewrite_request(answer: Answer) -> str:
    if not answer.uncited_texts():
        return NO_CITATIONS_INSTRUCTION
    items = "\n".join(f"- {t[:200]}" for t in answer.uncited_texts())
    return REWRITE_INSTRUCTION.format(items=items)
