# docs — індекс для людей і агентів

Читай перед задачею лише потрібне:

| Задача | Читати |
|---|---|
| Будь-яка (загальна картина) | [architecture.md](architecture.md) |
| Запустити локально, тести, конвенції коду | [development.md](development.md) |
| Як працювати командою: гілки, PR, зміни даних і БД | [workflow.md](workflow.md) |
| Деплой, Railway, змінні середовища | [deployment.md](deployment.md) |
| Що будуємо і для кого, демо-сценарій, правила агента | [product/mission.md](product/mission.md), [product/jtbd.md](product/jtbd.md) |
| UX-флоу студента (FLEX) | [product/student_flow_flex.md](product/student_flow_flex.md) (та сама версія у вигляді сторінки: [.html](product/student_flow_flex.html)) |
| Макети сторінок, дизайн-система StayHard, будь-яка робота з UI | [design/README.md](design/README.md) → [layouts_flex.html](design/layouts_flex.html), [stayhard-ds.html](design/stayhard-ds.html) |
| Поточні задачі | [tasks/](tasks/) (останнє: [0002 · Лендінг + сторінки 1A/2B/3A/4A/5B](tasks/0002-pages-1a-2b-3a-4a-5b.md) — зроблено; що лишилось команді — розділ «Перед демо»; попереднє: [0001](tasks/0001-home-overview-1b.md)) |
| 3D-відтворення експерименту для нового дослідження (як FLEX replay) | скіл [`.claude/skills/study-3d-replay`](../.claude/skills/study-3d-replay/SKILL.md): опитування → паспорт сцени → побудова → перевірка; у Claude Code — `/study-3d-replay` |
| Дані FLEX: схема таблиць, якість, як отримати | [data/flex.md](data/flex.md) |
| Дані CFI (PSI-39): схема знімка, якість, як зібрати | [data/cfi.md](data/cfi.md) |
| Агент: інструменти, SSE-контракт, ліміти, eval, UI-дії | [agent/README.md](agent/README.md), [agent/ui-actions.md](agent/ui-actions.md) |
| RAG: навіщо, технічні рішення, план і статус | [rag/mission.md](rag/mission.md), [rag/techstack.md](rag/techstack.md), [rag/plan.md](rag/plan.md) |
| PSI API (звідки качаємо) | [data/psi_api.md](data/psi_api.md) |
| Чому так, а не інакше | [decisions/](decisions/) (ADR) |

## Правила ведення docs
- Змінив архітектуру, API-контракт, схему БД або команди — онови відповідний документ **у тому ж PR**.
- Нове значуще рішення (вибір бібліотеки, сховища, підходу) → новий ADR `decisions/NNNN-slug.md` (контекст · рішення · наслідки, ≤ 1 сторінка).
- Мова документів — українська; код, ідентифікатори, тексти UI — англійська.
- `product/mission.md` — початкове бачення; якщо суперечить `architecture.md`, правда в `architecture.md`.
