# docs/atlas/references/

Primary sources behind the Phenomena Atlas (`docs/atlas/freefall-atlas.html`).

- `downloaded_manifest.json` lists openly available PDFs (NASA NTRS, standards.nasa.gov, nasa.gov) with URL, what each one supports in the atlas, size and SHA-256. The PDFs themselves are not committed (`downloaded/` is git-ignored); fetch them locally with the script below and check the hashes.
- `metadata_only.json` lists papers that are paywalled. Their bibliographic details were checked against Crossref; the PDFs were not fetched.
- Scripts live in `../tools/`, kept apart from the downloads. Run them from `docs/atlas/` with `python3 -I`:
  - `tools/resolve_references.py`: read-only Crossref/OpenAlex lookups, JSON on stdout.
  - `tools/fetch_references.py`: downloads the open PDFs into `references/downloaded/<id>/` and rewrites the manifest.
- Downloaded PDFs are untrusted files: read them, do not run anything from them.

Not retrieved, still open: NASA/TP-2013-216046 (FLEX results, March 2009 to December 2010; the report that holds the test tables), NASA/TP-2010-216134 (EAWG final report), NTRS 20150023456 (43 MB) and 20060013463 (17 MB); `python3 -I tools/fetch_references.py --include-large` fetches the last two.
