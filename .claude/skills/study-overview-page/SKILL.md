---
name: study-overview-page
description: Build or revise the overview page of one experiment (study) in Flame in Freefall, following the FLEX page. Use when asked to add or update a study overview, "tests to read first" cards, findings with charts, or the References block. Every chart, number and explanation must come from that study's own data.
---

# Study overview page (reference: FLEX, `features/study-overview`, PR #42)

You are a scientific-software engineer. Deliver what is asked and nothing more: no new features, refactors or abstractions beyond the page.

## Context
- Repo: `MartyniukAleksei/nasa-2026`. Frontend `frontend/` (React, Vite, TS, react-router, TanStack Query). Backend `backend/` (FastAPI, DuckDB, read-only).
- Read first: `CLAUDE.md`, `docs/README.md`, `docs/data/<study>.md` (for FLEX: `docs/data/flex.md`; others: `docs/data/psi-studies.md`), `docs/design/README.md`.
- Reference implementation: `frontend/src/features/study-overview/` (`components/TestCards.tsx`, `Findings.tsx`, `HowItWorked.tsx`, `References.tsx`, `testCards.ts`, `content.ts`, `refs.ts`, `lib/cardData.ts`).
- Input you need from the user: the study slug (e.g. `cfi`, `same-r`) and which tests or phenomena to feature. If missing, ask once, then proceed.

## Hard rules
1. **Data source.** Every chart and number comes from the API or snapshot of THIS study. Never reuse FLEX tests, numbers or findings on another study's page, and never invent a value.
2. **Labels.** Anything we compute (K fit, gaps, ratios, normalised d²) MUST be labelled "estimate" or "derived". A simulation MUST be labelled "simulation, not a measurement" with its dataset DOI.
3. **Check before drawing.** For each planned chart, fetch the series first (`/studies/<slug>/tests/{n}/timeseries/<signal>`). If a series is missing or empty, do not draw it. State the limit on the card (e.g. "this test has no flame series; the extinction time is not in the data").
4. **Test conditions** come from the `tests` table, never from TestSheet comments (some comments name the wrong fuel). Respect `fiber_conflict`.
5. **Fiber.** Never mix fiber-supported tests with free-floating droplets in counts, comparisons or charts. A deliberate fiber-vs-free pair is allowed only if the card says so.
6. **Disruption** means "self-extinction not observed". It NEVER means "would burn forever".
7. **Sources.** Cite only papers you verified via Crossref, OpenAlex or NTRS. Each has a clickable link (DOI or NTRS). NEVER invent a title, author, DOI or page range. If a source cannot be verified, say so in the final report and do not put it on the page. Claims in the text must be what the source supports, not what sounds plausible.
8. **No** myth-busting blocks, no "Two traps", no separate "How to cite". The dataset citation and licence live in References.
9. **Language.** UI text is English. Replies to the user are Ukrainian.

## Page structure (same order as FLEX)
1. Hero (existing component).
2. Example / 3D (if the study has it).
3. **Tests to read first**: cards, chart left, 2–3 short scientific notes right, each note with source links.
4. **How it worked**: schematic plus how many tests ended each way, counted from the API for free-floating droplets only, with a note on what was excluded.
5. **What was found**: per finding a chart, an evidence tag (`measured` or `derived from measurements`), the researchers' comment quoted from the data, a "Keep in mind" caveat, links to the paper, the test page and `series.csv`.
6. Presets (existing).
7. **References** at the bottom: full citations in order of first use, clickable DOI/NTRS, then the PSI dataset citation with a copy button and the licence.

## Card template
```
[phenomenon, small caps]
[Title, one line]
#<n> · <fuel> · <x_o2> O₂ in <diluent> · <p> atm · <fiber|free-floating> · <EndMark>   (from the tests table)
[TimeChart(s)]                       | What to know
[one-line caption with derived       | • note 1 (≤ 2 sentences)  → source links
 numbers, labelled estimate/derived] | • note 2                  → source links
                                     | • note 3                  → source links
```
Notes say what to look for in the data and cite the paper. They do not restate chart numbers by hand: numbers shown next to a chart are computed in code.

## Charts and style
- Use shared `TimeChart` and StayHard tokens only. Measured: hollow circles, `ink`. Our estimate: dashed `--flame`. Gaps: hatched band from `findGaps`, never joined by a line. Extra series: `--series-1`, `--series-2`, `--series-uv`. End colours `--end-*` only with their glyph (● ○ ◇) or a text label. The legend always names every series.
- No gradients, shadows or rounded corners. Charts load lazily when near the viewport.
- Pure helpers go in `lib/` with a `node:test` file.

## Workflow
1. Inspect the study's data (API, `docs/data`). Write down which signals exist and the limits of each candidate test.
2. Pick tests and findings. Verify every source. Draft `refs.ts` and the copy.
3. Implement inside `frontend/src/features/study-overview/` (or the study's own feature module). Do not edit `shared/`, `core/`, DB schema, backend or `data/`. If shared code needs a change, describe it for a separate small PR.
4. Run `npm run build` and `npm test` in `frontend/`. View the page in a browser against the real API (`VITE_PROXY_TARGET=<backend> npx vite`). Confirm every chart renders from data.
5. Create a branch `feat/<slug>-overview-...`, commit in small commits, push the branch and open a PR to `main`.

## Boundaries
NEVER: push to `main`, merge the PR, force-push, touch Railway, variables, volumes, releases, `data/` or `flame.duckdb`, add dependencies, or write to the DB.
STOP and ask before: changing shared code, adding a dependency, or when a needed series or source is not available and the card would need a guess.

## Done when
- [ ] Every chart's data comes from this study (list the endpoints used).
- [ ] No hand-typed statistic next to a chart; computed values are labelled estimate/derived; simulations are labelled.
- [ ] Each missing series is stated on its card; fiber and free-floating are not mixed; no Disruption misreading.
- [ ] Every reference is verified, has a working link, and is cited on the page; the dataset citation and licence are in References.
- [ ] No myth blocks, "Two traps" or "How to cite".
- [ ] `npm run build` and `npm test` pass; the page was viewed in a browser.
- [ ] PR opened, not merged.

## Final report (in Ukrainian, short)
Pages and files changed, tests and findings featured with the endpoints used, sources not verified or left out, limits stated on cards, PR link.
