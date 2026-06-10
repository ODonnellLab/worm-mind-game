# Game Design Decisions Log

---

## Endpoint types

| Type | Trigger | Behavior |
|------|---------|----------|
| `edge-of-knowledge` | Player reaches a research frontier insight | Full-screen endpoint + CTA to join page |
| `death` | Wrong choice near predator or harmful food | "You died. Try again." — restart from beginning |
| `bag` | Hunger meter fully depleted | Worm bags (reproduces) — resumes same position, same history, hunger reset |

---

## Bag endpoint / transgenerational inheritance (updated)

- Hunger depleted → worm reproduces → **offspring resume at same world position with same prompt history**
- Worm position, path state (proximityNodeId, etc.), history, eatUnlocked all preserved
- Only hunger, pathogenEaten, hungerPromptFired reset — the world continues unchanged
- `parentPathogens` array accumulates across bag events for potential transgenerational narrative variants
- **If offspring encounter the SAME PATHOGEN the parent encountered**: variant narrative referencing parent's prior experience — "something about this organism feels familiar, though you've never encountered it yourself"
- This is an **edge-of-knowledge** prompt: we know some pathogen-specific memory is transmitted (Kaletsky et al., Moore et al.) but we don't know if non-pathogenic bacteria exposure is transmitted to offspring
- Non-pathogenic bacteria re-encounter by offspring: NO inherited memory (fresh start)
- Mechanically: track which pathogen clusters the parent encountered; pass to offspring state

---

## Hunger / death mechanics

- Hunger builds continuously during exploration
- Hunger max → **bag endpoint** (starvation → egg-laying → offspring)
- Wrong choice near predator → **death endpoint**
- Wrong choice with pathogenic bacteria (2-step sequence, see below) → **death endpoint**

---

## Prompt queuing (proximity + hunger threshold)

Replace move-count queuing with:
1. **Proximity trigger**: worm enters detection radius of bacteria cluster or predator → queue relevant node
2. **Hunger threshold trigger**: hunger approaches maximum → queue `hunger-critical` node
3. Eating-related prompts do NOT fire during exploration away from food

---

## Universal first-encounter node

Fires on ALL 3 paths after `detect`, on first approach to any food patch.
Narrative varies by prior detect choice (via `variants`):
- `detect:smell` → "You've followed the smell here. The bacteria are right in front of you. What do you do?"
- `detect:taste` → "You've tasted your way here. The bacteria are right in front of you. What do you do?"
- `detect:touch` → "You've bumped into them. The bacteria are right in front of you. What do you do?"

**Choices** (same for all 3 variants):
1. Eat — approach and start feeding → advances to path-specific node
2. Assess first — circle and sample → advances to path-specific node (different explanation)
3. Reverse — back away → hunger does NOT reset; worm must navigate back; same patch re-encountered → `smell-familiar`

**Touch path specifics**: This node IS the touch path's entry point (double duty). Replaces needing a separate touch pre-node.

---

## Re-encounter mechanic

- First encounter with any bacteria patch → `detect` → first-encounter node
- Re-encounter same patch (e.g. after reversing) → `smell-familiar` directly
- Any future encounter with safe bacteria → `smell-familiar`
- Encounter with pathogen → `pathogen-encounter` (separate always)
- Hunger does NOT reset if player reverses without eating

---

## Smell path restructure

**New order:** `detect → first-encounter → smell-goodbad → smell-familiar → smell-eat (all 3 → endpoint)`

| Node | Notes |
|------|-------|
| first-encounter | New universal node (smell variant) |
| `smell-goodbad` | 2nd node — no edge-of-knowledge shortcut |
| `smell-familiar` | 3rd node — no edge-of-knowledge shortcut |
| `smell-eat` | 3rd choice added: **"Not clear yet"** → endpoint; ALL 3 choices → endpoint |
| `smell-change` | Deprecated — content absorbed into smell-eat choices |

---

## Taste path restructure

**New order:** `detect → first-encounter → taste-search → taste-goodbad → [deceived→endpoint] → taste-perception → taste-hunger → [chemical/fat→endpoint, time→taste-intertissue] → taste-endpoint`

| Node | Change |
|------|--------|
| first-encounter | New universal node (taste variant) |
| `taste-search` | Add 3rd choice: pharyngeal pumping as active sampling |
| `taste-goodbad` | `deceived` → endpoint (edge of knowledge) |
| NEW `taste-perception` | New node: "What controls how food tastes to you?" |
| `taste-hunger` | `chemical` and `fat` → edge of knowledge endpoints; `time` → `taste-intertissue` |
| `taste-intertissue` | Only reached via `time` in `taste-hunger` |

### taste-perception choices
- **[mood]** — "My mood affects how food tastes" → corrective explanation (mood in this sense not well-supported in C. elegans), continues to taste-hunger
- **[hunger]** — "How hungry I am changes what I taste" → correct → taste-hunger
- **[nothing]** — "Nothing — taste is taste, it doesn't change" → edge of knowledge / interesting: taste neurons are fairly hard-wired but hunger state does modulate them; advances to taste-hunger with different framing

---

## Touch path changes

**New order:** `detect → first-encounter (touch variant) → touch-goodbad → [cant-tell→endpoint] → touch-colonize → [both→endpoint] → touch-movement → endpoint`

- first-encounter node doubles as the touch path entry and hunger-reset decision point
- `reverse` at first-encounter → no food consumed, no hunger reset
- `touch-aversive` may be deprecated or repositioned (the warning signal concept moves into first-encounter or touch-goodbad)

---

## Predator encounter

**Add choice: `[ignore]` "Ignore it — it doesn't look dangerous"**
- This choice → **death endpoint** ("You were consumed. Try again.")
- Existing choices (smell-predator, feel-predator, invisible) → educational path continues

---

## Pathogen encounter — 2-step death sequence

1. `pathogen-encounter` choice `[eat]` "Eat them anyway — I'm hungry enough" → routes to a **pathogen-flavor smell-goodbad variant** (not normal smell-goodbad)
2. At that variant, the **naive answer** (`yes` — smell is reliable, this must be fine) → **death endpoint** ("The toxins overwhelmed your system. Try again.")
3. Cautious/correct answers at the variant → educational path, player survives
   - "Mostly — smell isn't perfect" → survives with explanation
   - "No — can't really tell" → survives, reaches edge of knowledge

This requires either:
- A new node `pathogen-goodbad` that routes to death on naive answer
- Or a `variant` of `smell-goodbad` with a different death-routing choice

---

## INDEX.md updates needed

After all restructuring, update INDEX.md node status table to reflect:
- New nodes: first-encounter, taste-perception, pathogen-goodbad (or variant)
- Deprecated: smell-change
- Modified: smell-eat (3rd choice), taste-search (3rd choice), predator-encounter (death choice), pathogen-encounter (routing)

---

## Gut content meters ✅ Done

Two meters in a second status bar row labeled "GUT":

| Meter | Color | Gain | Decay/move | Effect |
|-------|-------|------|------------|--------|
| Good bacteria load (`goodLoad`) | green | +20 per [E] eat | −0.3 (faster — digested) | hunger freezes while goodLoad > 0 |
| Harmful bacteria load (`harmLoad`) | orange→red | +25 per [E] eat | −0.1 (slower — colonizes) | death at harmLoad ≥ 100 |

- Replaces the old `pathogenEaten` integer counter with a continuous 0–100 scale
- **Hunger only increases when goodLoad = 0** — bacteria in gut suppress hunger, reflecting intertissue gut-brain signaling
- Good bacteria decay faster than harmful: good bacteria are digested and cleared; harmful bacteria colonize and persist
- Gut hint text appears to the right of the bars: "Bacteria colonizing gut", "Toxins accumulating", etc.
- `harmLoad` carried into `parentPathogens` on bag continuation for potential transgenerational variants

---

## Death route priority fix (implemented)

**Bug:** When a sidebar prompt (e.g. predator-encounter) was interrupted with a savedQueue, the `continueGame` savedQueue restoration ran before the death/endpoint route check — silently swallowing death routes like the predator `ignore` choice.

**Fix:** In `continueGame`, check whether `nextId` resolves to a death or endpoint node before restoring savedQueue. If so, discard the savedQueue and let death/endpoint fire normally.

---

## Pharynx-intro + eat mechanic (implemented)

- `pharynx-intro` node fires ONCE on first food contact of any kind (good bacteria or pathogen) — shows `Feeding_gcamp.gif` + pharyngeal pumping science
- After continuing from pharynx-intro: `state.eatUnlocked = true`, then the normal prompt (detect or pathogen-encounter) fires immediately
- `[E]` key near food: eat while in exploration phase (900ms cooldown)
  - Good bacteria: hunger -= 15; short non-blocking cutscene
  - Pathogen: pathogenEaten++, hunger -= 5; death at 4 eats via `death-pathogen` node
- Status bar shows `[E] to eat` or `[E] eat ⚠ dangerous` when near food and eat is unlocked

---

## Implementation queue

| # | Item | Status |
|---|------|--------|
| 1 | Death endpoint node type — game.js + CSS + index.html | ✅ Done |
| 2 | Bag endpoint node type — game.js + CSS + index.html | ✅ Done |
| 3 | Proximity-based prompt queuing (path prompts fire near bacteria) | ✅ Done |
| 4 | Hunger-max → bag trigger | ✅ Done |
| 4b | pharynx-intro node + [E] eat mechanic | ✅ Done |
| 5 | first-encounter node — nodes.json + variants | ⏳ Next |
| 6 | Smell path reorder (smell-goodbad first, then smell-familiar) | ⏳ |
| 7 | smell-eat 3rd choice ("Not clear yet" → endpoint) + smell-change deprecation | ⏳ |
| 8 | taste-search 3rd choice (pharyngeal pumping) | ⏳ |
| 9 | taste-goodbad `deceived` → endpoint | ⏳ |
| 10 | taste-perception new node (what controls taste perception?) | ⏳ |
| 11 | taste-hunger routing (chemical/fat→endpoint, time→intertissue) | ⏳ |
| 12 | predator-encounter `ignore` → death | ✅ Done |
| 13 | pathogen 2-step death sequence | ⏳ |
| 14 | Transgenerational offspring state (pathogen history across bag restart) | ⏳ |
| 15 | Hunger fills more slowly | ⏳ |
| 16 | Pathogen re-encounter: different prompts + partial hunger reset + death on repeat | ⏳ |

---

## Hunger pacing (item 15)

- **Current**: `state.hunger += 1` per worm move → reaches 100 in ~100 moves
- **Target**: slower — change to `+= 0.35` per move (~285 moves to max)
- Threshold constants in `HUNGER_THRESHOLDS` (HINT:20, CUT1:40, PARTIAL:60, CUT2:80, CRITICAL:90) stay the same numerically; they'll just fire later

---

## Pathogen re-encounter mechanics (item 16)

**State to add:** `state.pathogenEncounters: 0` — incremented each time worm enters a pathogen zone.

**On 1st encounter** (`pathogenEncounters === 0`): fire `'pathogen-encounter'` as now.

**On 2nd encounter** (`pathogenEncounters === 1`): fire `'pathogen-familiar'` — a new node with narrative like: *"You've been near this before. Your sensory neurons fire differently now — something about this smell is wrong. But you're still hungry."* Choices same structure, but one "eat anyway" choice on this node leads directly to death (2nd exposure = fatal dose).

**On 3rd+ encounter**: route directly to death (`showDeath`) without prompting — the worm has been poisoned past the point of recovery. Death narrative: *"You kept returning. The toxins accumulated."*

**Partial hunger reset on pathogen interaction**: if the player selects an "eat" choice at any pathogen node, set `state.hunger = Math.max(state.hunger - 25, 20)` — a small reduction (partial meal that doesn't satisfy) rather than a full reset. This is handled in `handleChoice` via a `"hungerEffect": "partial-bad"` field on those choices in nodes.json.

**nodes.json changes needed:**
- Add `pathogen-familiar` node with variants for 2nd encounter
- Add `"hungerEffect": "partial-bad"` on eat choices in `pathogen-encounter` and `pathogen-familiar`
- Add death route on `pathogen-familiar` eat choice

---

## Bag animation — completed

Flood-fill body mask using `##[10+ spaces]` seed (inner wall → cavity) + diagonal `#` dilation to seal staircase corners. 25 baby worms with per-worm `freq` and `amp` variation. Body-clipped tail rendering (segments outside mask are dropped). Canvas 300px tall to fit 53-row adult outline art.
