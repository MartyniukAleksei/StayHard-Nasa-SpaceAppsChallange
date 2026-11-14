# frontend — React + Vite + TypeScript

```bash
npm install
npm run dev        # http://localhost:5173, /api проксюється на :8000
npm run build      # tsc + vite build → dist/
```

Структура: `src/app` (роутер, провайдери) · `src/pages` (тонкі сторінки) · `src/features/*` (модулі фіч) · `src/shared` (api-клієнт, ui, lib, стилі). Імпорти через `@/`.
Див. `../docs/architecture.md`.
