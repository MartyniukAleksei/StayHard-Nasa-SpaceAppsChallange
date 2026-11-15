#!/usr/bin/env python3
"""Resolve bibliographic details for the Phenomena Atlas references via Crossref and OpenAlex.

Read-only metadata queries; no PDF is fetched here. Output: JSON on stdout.
"""
import json, sys, urllib.parse, urllib.request

REFS = {
    'godsave1953': 'Studies of the combustion of drops in a fuel spray: the burning of single drops of fuel | Godsave | 1953',
    'spalding1953': 'The combustion of liquid fuels | Spalding | 1953',
    'law1982': 'Recent advances in droplet vaporization and combustion | Law | 1982',
    'dietrich2014': 'Droplet Combustion Experiments Aboard the International Space Station | Dietrich | 2014',
    'nayagam2012': 'Can cool flames support quasi-steady alkane droplet burning | Nayagam | 2012',
    'farouk2014': 'Isolated n-heptane droplet combustion in microgravity cool flames two-stage combustion | Farouk | 2014',
    'chao1990': 'Structure and extinction of diffusion flames with flame radiation | Chao | 1990',
    'jackson1994': 'The effect of initial diameter in spherically symmetric droplet combustion of sooting fuels | Jackson | 1994',
    'marchese1996': 'The effect of liquid mass transport on the combustion and extinction of bicomponent droplets of methanol and water | Marchese | 1996',
    'marchese1998': 'Radiative effects in space-based methanol/water droplet combustion experiments | Marchese | 1998',
    'wang1984': 'Combustion and microexplosion of freely falling multicomponent droplets | Wang | 1984',
    'psi142pub': 'DOI 10.1016/j.combustflame.2017.01.028',
}

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'flex-reference-check/1.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def crossref_by_doi(doi):
    return get('https://api.crossref.org/works/' + urllib.parse.quote(doi))['message']

def crossref_search(title, author, year):
    q = urllib.parse.urlencode({'query.bibliographic': f'{title} {author} {year}', 'rows': 3})
    return get('https://api.crossref.org/works?' + q)['message']['items']

def summarise(w):
    year = (w.get('issued', {}).get('date-parts') or [[None]])[0][0]
    return {
        'title': (w.get('title') or [''])[0], 'doi': w.get('DOI'),
        'authors': [f"{a.get('family','')}, {a.get('given','')}" for a in w.get('author', [])][:8],
        'journal': (w.get('container-title') or [''])[0], 'volume': w.get('volume'), 'issue': w.get('issue'),
        'pages': w.get('page'), 'year': year,
    }

def openalex(doi):
    try:
        d = get('https://api.openalex.org/works/https://doi.org/' + urllib.parse.quote(doi))
    except Exception as e:
        return {'error': str(e)}
    best = d.get('best_oa_location') or {}
    return {'is_oa': d.get('open_access', {}).get('is_oa'), 'oa_status': d.get('open_access', {}).get('oa_status'),
            'pdf_url': best.get('pdf_url'), 'landing': best.get('landing_page_url'), 'license': best.get('license')}

out = {}
for key, spec in REFS.items():
    try:
        if spec.startswith('DOI '):
            w = crossref_by_doi(spec[4:])
            out[key] = {'match': summarise(w)}
        else:
            title, author, year = [s.strip() for s in spec.split('|')]
            items = crossref_search(title, author, year)
            out[key] = {'candidates': [summarise(i) for i in items]}
    except Exception as e:
        out[key] = {'error': str(e)}
for key, v in out.items():
    doi = (v.get('match') or (v.get('candidates') or [{}])[0]).get('doi')
    if doi:
        v['openalex_top'] = openalex(doi)
json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
