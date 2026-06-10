# Node audit: `smell-eat`

> "You're eating. Bacteria are entering your intestine. Some survive inside you and start producing chemicals — including neurotransmitters."

## Citations

| Status | Label | DOI | Claim |
|--------|-------|-----|-------|
| ✅ | O'Donnell et al., Nature 2020 | 10.1038/s41586-020-2395-5 | Providencia bacteria produce tyramine; host TBH enzyme converts it to octopamine (a monoamine neurotransmitter) |
| ✅ | Zang et al., bioRxiv 2026 | 10.64898/2026.02.14.704838 | Bacterial neurotransmitter manipulation of C. elegans behavior |

## Flags

- A 3rd choice ("Not clear yet" → endpoint) is on the implementation queue (item #7 in DESIGN.md). Once added, this node will fully absorb the smell-change path content.
- The `coincidence` and `evolved` choices currently route to `smell-change`. After restructure, both should route to `smell-endpoint` directly and `smell-change` will be deprecated.

## Status: ✅ DONE (citations)
⏳ 3rd choice + routing update pending implementation queue item #7
