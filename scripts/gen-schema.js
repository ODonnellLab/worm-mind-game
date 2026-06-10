#!/usr/bin/env node
// Regenerate schemas/nodes-schema.json from the website's references.json.
// Run from the worm-mind-game repo root: node scripts/gen-schema.js
// Expects ../odonnell-lab-website/data/references.json to exist (sibling repo).

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const refsPath   = resolve(__dirname, '../../odonnell-lab-website/data/references.json');
const schemaPath = resolve(__dirname, '../schemas/nodes-schema.json');

let refs;
try {
  refs = JSON.parse(readFileSync(refsPath, 'utf8'));
} catch (e) {
  console.error(`Could not read references.json at ${refsPath}`);
  console.error(e.message);
  process.exit(1);
}

const slugs = Object.keys(refs).sort();

const paperItems = { "type": "string", "enum": slugs };

const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "worm-mind-game nodes.json",
  "description": "Schema for data/nodes.json. Paper slugs must match keys in odonnell-lab-website/data/references.json.",
  "type": "object",
  "properties": {
    "$schema": { "type": "string" },
    "hunger_prompt": { "$ref": "#/definitions/promptNode" },
    "nodes": {
      "type": "object",
      "additionalProperties": { "$ref": "#/definitions/node" }
    }
  },
  "definitions": {
    "paperSlug": paperItems,
    "papersArray": {
      "type": "array",
      "items": paperItems,
      "description": "Array of reference slugs from references.json. Shown in [H] during game."
    },
    "morePapersArray": {
      "type": "array",
      "items": paperItems,
      "description": "Extended reference list. Shown on further-reading page only."
    },
    "choice": {
      "type": "object",
      "properties": {
        "id":          { "type": "string" },
        "label":       { "type": "string" },
        "sublabel":    { "type": "string" },
        "summary":     { "type": "string" },
        "explanation": { "type": "string" },
        "science":     { "type": "string" },
        "next":        { "type": "string" },
        "papers":      { "$ref": "#/definitions/papersArray" },
        "morePapers":  { "$ref": "#/definitions/morePapersArray" }
      },
      "required": ["id", "label"]
    },
    "node": {
      "type": "object",
      "properties": {
        "id":         { "type": "string" },
        "phase":      { "type": "string" },
        "type":       { "type": "string", "enum": ["death", "endpoint"] },
        "image":      { "type": "string" },
        "narrative":  { "type": "string" },
        "science":    { "type": "string" },
        "cta":        { "type": "string" },
        "header":     { "type": "string" },
        "choices":    { "type": "array", "items": { "$ref": "#/definitions/choice" } },
        "papers":     { "$ref": "#/definitions/papersArray" },
        "morePapers": { "$ref": "#/definitions/morePapersArray" }
      },
      "required": ["id"]
    },
    "promptNode": {
      "type": "object",
      "properties": {
        "id":       { "type": "string" },
        "phase":    { "type": "string" },
        "image":    { "type": "string" },
        "narrative":{ "type": "string" },
        "choices":  { "type": "array", "items": { "$ref": "#/definitions/choice" } },
        "papers":   { "$ref": "#/definitions/papersArray" },
        "morePapers": { "$ref": "#/definitions/morePapersArray" }
      }
    }
  }
};

mkdirSync(dirname(schemaPath), { recursive: true });
writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + '\n');
console.log(`✓ Generated schemas/nodes-schema.json with ${slugs.length} slugs`);
slugs.forEach(s => console.log(`  ${s}`));
