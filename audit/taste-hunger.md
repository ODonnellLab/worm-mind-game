# Node audit: `taste-hunger`

> "Hunger isn't just about how full your stomach is — it's a whole-body state. What else controls it?"

## Citations

| Status | Label | DOI | Claim |
|--------|-------|-----|-------|
| ✅ | O'Donnell et al., PLoS Genetics 2018 | 10.1371/journal.pgen.1007213 | Intertissue signaling pathways encode nutritional state from gut to nervous system; TORC2/Rictor-dependent routes |

## Flags

- Currently all 3 choices route to `taste-intertissue`. Implementation queue item #11: `chemical` and `fat` choices should route to edge-of-knowledge endpoints; only `time` → `taste-intertissue`. This routing change is pending.
- A new pre-node `taste-perception` ("what controls how food tastes to you?") is planned to sit before this node (queue item #10). Once added, the framing here may need adjustment.

## Status: ✅ DONE (citations)
⏳ Routing change for `chemical`/`fat` choices pending queue item #11
⏳ taste-perception pre-node pending queue item #10
