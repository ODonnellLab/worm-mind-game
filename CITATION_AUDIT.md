# Citation Audit — Worm Mind Game nodes.json

Generated 2026-06-07. Sub-agents blocked on WebFetch (session permission); B1–B5 results from training data.

## Group A — Lab papers (verified by PI)
| Paper | DOI | Status |
|-------|-----|--------|
| O'Donnell et al., Nature 2020 | 10.1038/s41586-020-2395-5 | ✅ confirmed |
| O'Donnell et al., PLoS Genetics 2018 | 10.1371/journal.pgen.1007213 | ✅ confirmed |
| Malaiwong et al., bioRxiv 2025 | 10.1101/2025.10.20.683577 | ✅ confirmed |
| Zang et al., bioRxiv 2026 | 10.64898/2026.02.14.704838 | ✅ confirmed |

---

## Group B — Classical C. elegans papers

### B1: Bargmann & Horvitz, Science 1991
- **Full citation:** Bargmann CI, Horvitz HR. "Chemosensory neurons with overlapping functions direct chemotaxis to multiple chemicals in C. elegans." Science 251(4998):1243–1246.
- **DOI:** 10.1126/science.1749929
- **Used in:** `detect`, `touch-aversive`, `pathogen-encounter`
- **Claim:** AWC/AWA detect volatile odorants; ASE/ASG detect dissolved ions; ASH detects harsh chemicals and physical contact; triggers rapid reversals via AVA command interneurons
- **Result:** ⚠️ PARTIAL — establishes AWC/AWA/ASE/ASG sensory identities. ASH→AVA reversal pathway is better supported by Kaplan & Horvitz 1993 PNAS. Citation OK for sensory neuron identities; add K&H 1993 for nociceptive avoidance in `touch-aversive`.

### B2: Bargmann, WormBook 2006
- **Full citation:** Bargmann CI. "Chemosensation in C. elegans." WormBook 2006. doi:10.1895/wormbook.1.46.1
- **DOI:** 10.1895/wormbook.1.46.1
- **Used in:** `locomotion-forward`, `taste-search`
- **Claim:** AVB forward, AVA reverse; run/pirouette foraging strategy
- **Result:** ⚠️ PARTIAL — chemosensation chapter, not canonical locomotion reference. Accepted by PI as OK.

### B3: Chalfie et al., J Neurosci 1985
- **Full citation:** Chalfie M, Sulston JE, White JG, Southgate E, Thomson JN, Brenner S. "The neural circuit for touch sensitivity in Caenorhabditis elegans." J Neurosci 5(4):956–964.
- **DOI:** 10.1523/JNEUROSCI.05-04-00956.1985
- **Used in:** `detect`
- **Claim:** Mechanosensory neurons (ALM, AVM, PLM, PVM) respond to physical contact
- **Result:** ✅ YES — canonical mechanosensory paper, exactly right.

### B4: Torayama et al., J Neurosci 2007
- **Full citation:** Torayama I, Ishihara T, Katsura I. "Caenorhabditis elegans integrates the signals of butanone and food to enhance chemotaxis to butanone." J Neurosci 27(4):741–750.
- **DOI confirmed:** 10.1523/JNEUROSCI.4312-06.2007 ← updated in nodes.json
- **Used in:** `smell-familiar`
- **Claim:** Positive associative olfactory conditioning — familiar food-associated odors preferred
- **Result:** ✅ YES — textbook positive associative olfactory conditioning via AWC^ON.

### B5: Chalasani et al., PLOS Biology 2010 ← WRONG PAPER, NEEDS REPLACEMENT
- **DOI:** 10.1371/journal.pbio.1000372
- **Actual paper:** Chalasani SH et al. "Neuropeptide feedback modifies odor-evoked dynamics in C. elegans olfactory neurons." PLOS Biology 2010.
- **Used in:** `smell-familiar`
- **Result:** ❌ MISMATCH — neuropeptide modulation of AWC dynamics, NOT food-paired associative learning. Must replace.
- **Action needed from PI:** Suggest a second reference for positive associative learning. Options: Nuttley et al., Eur J Neurosci 2002? Or use Torayama 2007 alone?

---

## Group C — Predator/pathogen papers (WebFetch blocked; author labels and claim verification pending)

### C1: Schiffer et al., PLOS Pathogens 2021
- **DOI:** 10.1371/journal.ppat.1010112
- **Used in:** `pathogen-encounter`, `touch-goodbad`
- **Claim:** C. elegans avoids pathogens via chemosensory cues; multi-channel bacterial quality assessment
- **Result:** PENDING — manual verification needed

### C2: Author et al., Curr Biol 2011
- **DOI:** 10.1016/j.cub.2011.06.063
- **Used in:** `predator-encounter`
- **Result:** PENDING — need author label + claim check

### C3: Author et al., eLife 2016
- **DOI:** 10.7554/eLife.20023
- **Used in:** `predator-encounter`
- **Result:** PENDING — need author label + claim check

### C4: Author et al., Nat Commun 2021
- **DOI:** 10.1038/s41467-021-25535-1
- **Used in:** `predator-encounter`
- **Result:** PENDING — need author label + claim check

### C5: Author et al., iScience 2025
- **DOI:** 10.1016/j.isci.2025.112792
- **Used in:** `predator-encounter`
- **Result:** PENDING — need author label + claim check

---

## Group D — References still needed (discussion pending with PI)

### D1: smell-goodbad
- **Current ref:** O'Donnell et al., Nature 2020 ❌ WRONG — about bacterial octopamine manipulation, not olfactory food quality discrimination
- **Question to clarify:** Is this node about olfactory discrimination of bacterial quality, or about the inherent unreliability of volatile signals as quality proxies?
- **Need:** Paper on olfactory coding of bacterial quality in C. elegans

### D2: taste-goodbad
- **Current ref:** O'Donnell et al., Nature 2020 ❌ WRONG — same mismatch
- **Question to clarify:** Is this about ASE neuron-based taste discrimination, or contact chemosensation reliability for detecting harmful bacteria?
- **Need:** Paper on ASE-based or contact chemosensation for food quality in C. elegans

---

## Fixes applied to nodes.json

| Fix | Status |
|-----|--------|
| Malaiwong DOI: confirmed 10.1101/2025.10.20.683577 | ✅ done |
| Zang DOI: confirmed 10.64898/2026.02.14.704838 | ✅ done |
| smell-familiar: replaced Khan 2022 + Philbrook 2024 with Torayama 2007 + pbio.1000372 (partial) | ✅ done |
| Torayama DOI updated to 10.1523/JNEUROSCI.4312-06.2007 | ✅ done |
| pbio.1000372 flagged as wrong in nodes.json (placeholder label) | ✅ done, needs replacement |
| predator-encounter: replaced Bargmann WormBook with 4 fungi papers | ✅ done |
| touch-aversive narrative: "touch neurons / harsh chemical" → "danger-sensing neurons" | ✅ done |
| touch-aversive: add Kaplan & Horvitz 1993 PNAS for ASH→AVA nociceptive avoidance | ⏳ pending — confirm DOI |
| smell-familiar B5: needs new second reference for associative learning | ⏳ pending PI input |
| smell-goodbad D1: O'Donnell 2020 needs replacement | ⏳ pending PI input |
| taste-goodbad D2: O'Donnell 2020 needs replacement | ⏳ pending PI input |
| predator-encounter C2–C5: author labels needed | ⏳ pending manual lookup |
