#!/usr/bin/env python3
"""
Regenerate schemas/nodes-schema.json from the website's references.json.
Run from the worm-mind-game repo root:  python3 scripts/gen-schema.py
Expects ../odonnell-lab-website/data/references.json (sibling repo).
"""
import json, os, sys

script_dir  = os.path.dirname(os.path.abspath(__file__))
refs_path   = os.path.join(script_dir, '../../odonnell-lab-website/data/references.json')
schema_path = os.path.join(script_dir, '../schemas/nodes-schema.json')

try:
    with open(refs_path) as f:
        refs = json.load(f)
except Exception as e:
    print(f'Could not read references.json at {refs_path}')
    print(e); sys.exit(1)

slugs = sorted(refs.keys())

paper_items = {'type': 'string', 'enum': slugs}

papers_array = {
    'type': 'array',
    'items': paper_items,
    'description': 'Reference slugs from references.json — shown in [H] during game.'
}
more_papers_array = {
    'type': 'array',
    'items': paper_items,
    'description': 'Extended reference list — shown on further-reading page only.'
}

choice_def = {
    'type': 'object',
    'properties': {
        'id':          {'type': 'string'},
        'label':       {'type': 'string'},
        'sublabel':    {'type': 'string'},
        'summary':     {'type': 'string'},
        'explanation': {'type': 'string'},
        'science':     {'type': 'string'},
        'next':        {'type': 'string'},
        'papers':      {'$ref': '#/definitions/papersArray'},
        'morePapers':  {'$ref': '#/definitions/morePapersArray'},
    },
    'required': ['id', 'label']
}

node_def = {
    'type': 'object',
    'properties': {
        'id':         {'type': 'string'},
        'phase':      {'type': 'string'},
        'type':       {'type': 'string', 'enum': ['death', 'endpoint']},
        'image':      {'type': 'string'},
        'narrative':  {'type': 'string'},
        'science':    {'type': 'string'},
        'cta':        {'type': 'string'},
        'header':     {'type': 'string'},
        'choices':    {'type': 'array', 'items': {'$ref': '#/definitions/choice'}},
        'papers':     {'$ref': '#/definitions/papersArray'},
        'morePapers': {'$ref': '#/definitions/morePapersArray'},
    },
    'required': ['id']
}

schema = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    'title': 'worm-mind-game nodes.json',
    'description': 'Schema for data/nodes.json. Paper slugs must match keys in odonnell-lab-website/data/references.json.',
    'type': 'object',
    'properties': {
        '$schema':      {'type': 'string'},
        'hunger_prompt': {'$ref': '#/definitions/node'},
        'nodes':         {'type': 'object', 'additionalProperties': {'$ref': '#/definitions/node'}},
    },
    'definitions': {
        'papersArray':     papers_array,
        'morePapersArray': more_papers_array,
        'choice':          choice_def,
        'node':            node_def,
    }
}

os.makedirs(os.path.dirname(schema_path), exist_ok=True)
with open(schema_path, 'w') as f:
    json.dump(schema, f, indent=2)
    f.write('\n')

print(f'✓ Generated schemas/nodes-schema.json with {len(slugs)} slugs')
for s in slugs:
    print(f'  {s}')
