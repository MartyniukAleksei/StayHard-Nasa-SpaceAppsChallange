# Прототип: 3D-відтворення тесту SAME-R (PSI-101)

Окремий Vite-застосунок, тестове середовище сцени до перенесення у `frontend/`. Паспорт сцени і рішення: [ADR 0009](../docs/decisions/0009-same-r-3d-replay.md). Дані: [docs/data/same_r.md](../../docs/data/same_r.md).

## Запуск
```bash
# БД з SAME-R має бути зібрана (docs/data/psi-studies.md §5)
# бекенд (з backend/)
uv run uvicorn flame.main:app --port 8000
# прототип (звідси)
npm install
npm run dev     # :5175, /api проксюється на :8000 (або VITE_PROXY_TARGET)
npm test        # node:test, lib/experiment
npm run build   # tsc -b && vite build
```
`http://localhost:5175/?test=53` — інший тест (типово 73; тести приймання 73, 53, 89).
`?test=53&t=384` — відкрити на паузі в заданій секунді (для звірки чисел з CSV).

## Звідки дані
Усе з API, нічого не зашито в код: `/api/studies/same-r/tests/{n}` (рядки таблиці, `coverage`, ТЕМ-архіви) і `/api/studies/same-r/tests/{n}/timeseries/hkp` (1 Гц телеметрія, `t_s = 0` — увімкнення нагрівача).

## Що з даних, а що ні
Перелік — у примітці під сценою і в паспорті ADR 0008. Коротко: з даних — нагрівач, температура диму, P-Trak, маса DustTrak B, сигнали активних детекторів; за документами — розміри камери витримки і рівень 2 мг/м³; порядок вузлів за потоком (зразок → камера витримки → канал діагностики з детекторами і приладами) — теж за документами; схематично — усі розміри й положення, крім камери; художнє — серпанок у каналі, його колір і дрейф. Дим усередині камери, форму диму, рух поршня, пороги детекторів і розміри частинок не показуємо.

## Перенесення у `frontend/`
Зроблено: сцена живе у `frontend/src/features/same-r-3d` (сторінка `/studies/same-r/tests/:id`); `lib/series.ts` і `lib/playback.ts` там — копії з `experiment-3d` (shortcut). Нижче — початковий план.

`src/features/same-r-3d/` має структуру фічі (`index.ts` → `SameR3D`). Кроки: винести `lib/series.ts` і `lib/playback.ts` у `frontend/src/shared/three` (зараз це копії з `experiment-3d`), замінити `api.ts` на `apiGet` + TanStack Query, додати маршрут `/studies/same-r/tests/:id/replay`.
