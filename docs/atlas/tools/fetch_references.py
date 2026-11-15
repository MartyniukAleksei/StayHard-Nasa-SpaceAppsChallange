#!/usr/bin/env python3
"""Download openly available primary sources for the Phenomena Atlas into references/downloaded/.

Rules
- Only open sources (NASA NTRS, standards.nasa.gov, nasa.gov, publisher pages marked open access).
  Paywalled papers are NOT fetched; their Crossref-verified metadata goes into references/metadata_only.json.
- Every download lands in its own new directory, is checked for the %PDF magic bytes, hashed, and never opened or executed here.
- This script lives in tools/, away from the downloaded files. Run with: python3 -I tools/fetch_references.py [--include-large]  (large = over ~15 MB)
"""
import hashlib, json, os, subprocess, sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, 'references', 'downloaded')
MAX_BYTES = 80 * 1024 * 1024
NTRS = 'https://ntrs.nasa.gov/api/citations/%s/downloads/%s'

ITEMS = [
    {'id': 'ntrs-20150023456', 'file': '20150023456.pdf', 'url': NTRS % ('20150023456', '20150023456.pdf'),
     'title': 'Detailed Results from the Flame Extinguishment Experiment (FLEX), March 2009 to December 2010 (NASA technical report)',
     'supports': 'FLEX test table (incl. test identifiers), burning rates, extinction diameters; audit of FLEX-197/198 identifiers', 'large': True},
    {'id': 'ntrs-20140006750', 'file': '20140006750.pdf', 'url': NTRS % ('20140006750', '20140006750.pdf'),
     'title': 'Cool-flame Extinction During N-Alkane Droplet Combustion in Microgravity (Nayagam et al.)',
     'supports': 'cool flame after visible extinction in heptane droplets'},
    {'id': 'ntrs-20120016855', 'file': '20120016855.pdf', 'url': NTRS % ('20120016855', '20120016855.pdf'),
     'title': 'Methanol Droplet Extinction in Oxygen/Carbon-dioxide/Nitrogen Mixtures in Microgravity',
     'supports': 'methanol FLEX extinction results, CO2 diluent'},
    {'id': 'ntrs-20205008449', 'file': 'Effects-of-ambient-inert-gas-properties-Nayagam-Williams.pdf',
     'url': NTRS % ('20205008449', 'Effects%20of%20ambient%20inert%20gas%20properties%20-Combustion%20Science-Nayagam-FAW.pdf'),
     'title': 'Effects of Ambient Inert Gas Properties on Cool-Flame Combustion of Normal-Alkane Droplets',
     'supports': 'role of diluent (He, CO2, N2) in droplet burning and cool flames'},
    {'id': 'ntrs-20150021491', 'file': '20150021491.pdf', 'url': NTRS % ('20150021491', '20150021491.pdf'),
     'title': 'Evidence Report: Risk of Hypobaric Hypoxia from the Exploration Atmosphere (NASA HRP)',
     'supports': 'exploration atmospheres: 8.2 psia / 34% O2, 10.2 psia / 26.5% O2, flammability margin at maximum O2'},
    {'id': 'ntrs-20060013463', 'file': '20060013463.pdf', 'url': NTRS % ('20060013463', '20060013463.pdf'),
     'title': 'Exploration Spacecraft and Space Suit Internal Atmosphere Pressure and Composition',
     'supports': 'early (2006) exploration atmosphere trade study, suit pressure', 'large': True},
    {'id': 'nasa-std-6001b-change3', 'file': 'NASA-STD-6001B_Change3.pdf',
     'url': 'https://standards.nasa.gov/sites/default/files/standards/NASA/B-w/CHANGE-3/3/2025_06_25_NASA-STD-6001B_w_Change_3_FINAL_Admin-Change-FINAL.pdf',
     'title': 'NASA-STD-6001B with Change 3: Flammability, Offgassing, and Compatibility Requirements and Test Procedures',
     'supports': 'normal-gravity flammability tests (Test 1 upward flame propagation) that FLEX/BASS-II results are compared against'},
    {'id': 'nasa-efield-srd', 'file': 'E-FIELD_Flames_SRD_20100402.pdf',
     'url': 'https://www1.grc.nasa.gov/wp-content/uploads/E-FIELD_Flames_SRD_20100402.pdf',
     'title': 'E-FIELD Flames: Science Requirements Document (NASA GRC, 2010)',
     'supports': 'what ACME E-FIELD actually investigates (ion production, ion-driven wind)'},
    {'id': 'ntrs-20210021781', 'file': 'JASMAC-ACME-paper-20210921.pdf', 'url': NTRS % ('20210021781', 'JASMAC%20ACME%20paper%2020210921.pdf'),
     'title': 'Recent Research on Flames of Gaseous Fuel Aboard the ISS (ACME, JASMAC)',
     'supports': 'ACME E-FIELD results and scope'},
]


def fetch(item):
    folder = os.path.join(DEST, item['id'])
    path = os.path.join(folder, item['file'])
    rec = {k: item[k] for k in ('id', 'title', 'url', 'supports')}
    rec['retrieved_utc'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
    if os.path.exists(path):
        rec['status'] = 'already present'
    else:
        os.makedirs(folder, exist_ok=True)
        part = path + '.part'
        # curl uses the system trust store; arguments are passed as a list (no shell).
        cmd = ['curl', '-sS', '-L', '--fail', '--max-time', '900', '--max-filesize', str(MAX_BYTES),
               '-A', 'Mozilla/5.0 flex-reference-fetch/1.0', '-o', part, item['url']]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode != 0:
                raise RuntimeError((proc.stderr.strip() or f'curl exit {proc.returncode}')[:120])
            with open(part, 'rb') as f:
                if f.read(5) != b'%PDF-':
                    raise ValueError('not a PDF')
            os.replace(part, path)
            rec['status'] = 'downloaded'
        except Exception as e:  # network or HTTP error: record and move on
            rec['status'] = f'failed: {e}'
            for leftover in (part, path):
                if os.path.exists(leftover):
                    os.remove(leftover)
            if os.path.isdir(folder) and not os.listdir(folder):
                os.rmdir(folder)
            return rec
    rec['path'] = os.path.relpath(path, ROOT)
    rec['bytes'] = os.path.getsize(path)
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    rec['sha256'] = h.hexdigest()
    print(f"{rec['status']:<16} {rec['id']:<34} {rec['bytes']} bytes", flush=True)
    return rec


def main():
    os.makedirs(DEST, exist_ok=True)
    include_large = '--include-large' in sys.argv
    results = [fetch(i) for i in ITEMS if include_large or not i.get('large')]
    with open(os.path.join(ROOT, 'references', 'downloaded_manifest.json'), 'w') as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
    for r in results:
        if r['status'].startswith(('failed', 'rejected')):
            print(f"{r['status'][:60]:<62} {r['id']}")


if __name__ == '__main__':
    main()
