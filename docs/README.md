# docs — індекс для людей і агентів

Читай перед задачею лише потрібне:

| Задача | Читати |
|---|---|
| Будь-яка (загальна картина) | [architecture.md](architecture.md) |
| Запустити локально, тести, конвенції коду | [development.md](development.md) |
| Як працювати командою: гілки, PR, зміни даних і БД | [workflow.md](workflow.md) |
| Деплой, Railway, змінні середовища | [deployment.md](deployment.md) |
| Що будуємо і для кого, демо-сценарій, правила агента | [product/mission.md](product/mission.md), [product/jtbd.md](product/jtbd.md) |
| UX-флоу студента (FLEX) | [product/student_flow_flex.md](product/student_flow_flex.md) |
| Дані FLEX: схема таблиць, якість, як отримати | [data/flex.md](data/flex.md) |
| PSI API (звідки качаємо) | [data/psi_api.md](data/psi_api.md) |
| Чому так, а не інакше | [decisions/](decisions/) (ADR) |

## Правила ведення docs
- Змінив архітектуру, API-контракт, схему БД або команди — онови відповідний документ **у тому ж PR**.
- Нове значуще рішення (вибір бібліотеки, сховища, підходу) → новий ADR `decisions/NNNN-slug.md` (контекст · рішення · наслідки, ≤ 1 сторінка).
- Мова документів — українська; код, ідентифікатори, тексти UI — англійська.
- `product/mission.md` — початкове бачення; якщо суперечить `architecture.md`, правда в `architecture.md`.
