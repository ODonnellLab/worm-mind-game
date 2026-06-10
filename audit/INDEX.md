# Citation & Content Audit — Worm Mind Game

Last updated: 2026-06-10. Source of truth: `data/nodes.json`. Audit files are for citation tracking and content flags only — do not duplicate node text here.

---

## Node status

| Node | File | Citations | Flags | Status |
|------|------|-----------|-------|--------|
| `hunger_prompt` | [hunger-critical.md](hunger-critical.md) | ✅ 2 lab papers | None | ✅ Done |
| `locomotion-forward` | [locomotion-forward.md](locomotion-forward.md) | ✅ 2 refs | None | ✅ Done |
| `pathogen-encounter` | [pathogen-encounter.md](pathogen-encounter.md) | ✅ 2 refs | Add Kaplan & Horvitz 1993 (nice-to-have) | ✅ Done |
| `predator-encounter` | [predator-encounter.md](predator-encounter.md) | ✅ 4 refs verified | None | ✅ Done |
| `pharynx-intro` | [pharynx-intro.md](pharynx-intro.md) | ⏳ 2 refs not formally audited | Avery papers need DOI/claim check | ⚠️ Needs review |
| `detect` | [detect.md](detect.md) | ✅ 4 refs | None | ✅ Done |
| `smell-familiar` | [smell-familiar.md](smell-familiar.md) | ❌ 1 wrong DOI | Replace 10.1371/journal.pbio.1000372 (Chalasani neuropeptide paper, not associative learning) | ❌ Needs fix |
| `smell-goodbad` | [smell-goodbad.md](smell-goodbad.md) | ✅ 4 refs | None | ✅ Done |
| `smell-eat` | [smell-eat.md](smell-eat.md) | ✅ 2 lab papers | 3rd choice pending (queue #7) | ✅ Done |
| `smell-change` | [smell-change.md](smell-change.md) | ✅ 2 lab papers | Pending deprecation after queue #7 | ✅ Done (live) |
| `smell-endpoint` | [smell-endpoint.md](smell-endpoint.md) | n/a (endpoint) | None | ✅ Done |
| `taste-search` | [taste-search.md](taste-search.md) | ✅ 1 ref | 3rd choice pending (queue #8) | ✅ Done |
| `taste-goodbad` | [taste-goodbad.md](taste-goodbad.md) | ❌ wrong ref | Replace O'Donnell 2020 — wrong claim | ❌ Needs PI input |
| `taste-hunger` | [taste-hunger.md](taste-hunger.md) | ✅ 1 lab paper | Routing change pending (queue #11) | ✅ Done |
| `taste-intertissue` | [taste-intertissue.md](taste-intertissue.md) | ✅ 2 lab papers | None | ✅ Done |
| `taste-endpoint` | [taste-endpoint.md](taste-endpoint.md) | n/a (endpoint) | None | ✅ Done |
| `touch-aversive` | [touch-aversive.md](touch-aversive.md) | ✅ 2 refs | Hunger-modulated avoidance ref nice-to-have | ✅ Done |
| `touch-goodbad` | [touch-goodbad.md](touch-goodbad.md) | ⏳ 1 ref pending claim check | Confirm Schiffer 2021 fits multi-channel framing | ⚠️ Needs review |
| `touch-colonize` | [touch-colonize.md](touch-colonize.md) | ✅ 1 lab paper | None | ✅ Done |
| `touch-movement` | [touch-movement.md](touch-movement.md) | ✅ 2 lab papers | None | ✅ Done |
| `touch-endpoint` | [touch-endpoint.md](touch-endpoint.md) | n/a (endpoint) | Confirm "100+ strains" claim with PI | ✅ Done |
| `death-predator` | [death-predator.md](death-predator.md) | n/a (death) | None | ✅ Done |
| `death-pathogen` | [death-pathogen.md](death-pathogen.md) | n/a (death) | None | ✅ Done |

---

## Open issues requiring PI input

| # | Node | Issue |
|---|------|-------|
| 1 | `smell-familiar` | Replace DOI 10.1371/journal.pbio.1000372 (Chalasani neuropeptide paper — wrong). Need a second ref for positive olfactory associative learning alongside Torayama 2007. |
| 2 | `taste-goodbad` | Replace O'Donnell 2020 (wrong claim). Need a paper on contact chemosensation reliability for bacterial quality assessment. |
| 3 | `pharynx-intro` | Verify Avery & Horvitz 1989 (10.1016/0896-6273(89)90092-2) and Avery & Shtonda 2003 (10.1242/jeb.00375) — classic papers likely correct but not yet formally checked. |
| 4 | `touch-goodbad` | Confirm Schiffer 2021 is the right reference for multi-channel quality assessment (vs. the more specific H2O2 sensing claim it is used for in `pathogen-encounter`). |
| 5 | `touch-endpoint` | Confirm "over 100 bacterial strains screened" claim. |

---

## Implementation queue items affecting content (from DESIGN.md)

| Queue # | Item | Audit impact |
|---------|------|-------------|
| 7 | smell-eat 3rd choice + smell-change deprecation | Update smell-eat.md, deprecate smell-change.md |
| 8 | taste-search 3rd choice | Update taste-search.md; add citation for pharyngeal sampling |
| 10 | taste-perception new node | New audit file needed |
| 11 | taste-hunger routing (chemical/fat → endpoint) | New endpoint audit files for those routes |
| 13 | pathogen 2-step death (pathogen-familiar node) | New audit file needed |

---

## See also

- [DESIGN.md](DESIGN.md) — full design decisions and implementation queue
- [../CITATION_AUDIT.md](../CITATION_AUDIT.md) — prior session citation verification records
