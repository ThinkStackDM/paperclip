# TSBC Lane-Hardening Readout — 2026-06-22

**Status:** BASE matrix = decision-grade (9 tasks × 6 cheap models, ≥5 samples). WITH-SKILLS = 18/24 cells decision-grade (claude-haiku + grok lanes complete; **gpt-5.4-mini with-skills still filling, n≈2–3 → preliminary, marked ⚠**). gemini lanes are excluded from the SINGLE-SHOT with-skills drill (agy can't do large single-shot prompts — see [[tsbc-bootcamp-vision]]); gemini base numbers are sound. **NEW 2026-06-22: gemini with-skills now measured AGENTICALLY** (`variants_agentic.py`, production-faithful frame) for cv-review / book-chapter / content — see §2b. This closes the gemini with-skills gap for the decision-relevant lanes.

## 1) Base leaderboard — best cheap model per task (bare model, no skills)
| task | winner | q | close runners-up |
|---|---|---|---|
| content | **gpt-5.4-mini** | 0.899 | claude-haiku 0.896 (tie), gemini-flash-low 0.876 |
| book-chapter | **gemini-flash-low** | 0.955 | grok-4-fast 0.950, grok-4.1-fast 0.947 |
| video-hook | **claude-haiku** | 0.958 | gemini-flash-low 0.943, gemini-flash 0.942 |
| social-post | **grok-4-fast** | 0.921 | grok-4.1-fast 0.921 (tie), gpt-5.4-mini 0.910 |
| designer | **grok-4.1-fast** | 0.967 | gpt-5.4-mini 0.959, grok-4-fast 0.951 |
| summarize-extract | **claude-haiku** | 0.961 | gemini-flash 0.933, gemini-flash-low 0.910 |
| cv-review | **gemini-flash** | 0.906 | gemini-flash-low 0.895, claude-haiku 0.789 |
| intake | (all tie) | 1.000 | trivial task — any lane |
| ops | **claude-haiku** | 0.971 | grok-4-fast 0.967, gemini-flash 0.965 |

## 2) With-skills marginal lift (current:none → current:all)
- **Skills add little for claude/grok** on most roles (±0.01–0.05) — the 65k-token skill bundle generally isn't worth its cost on these already-strong lanes. Two real exceptions:
  - **designer + claude-haiku: +0.122** (0.818→0.940, n=8) — skills materially fix haiku on designer.
  - **ops/content + grok-4-fast: +0.045–0.048** (n=7) — modest but real.
- **gpt-5.4-mini is SKILL-HUNGRY** ⚠(n≈3, preliminary): book-chapter **+0.170** (0.706→0.876), cv-review **+0.117** (0.717→0.833), content **+0.042**. It's weak bare on structured roles but the skill scaffolding rescues it. → If gpt-5.4-mini is a drafter, always give it the skills.
- **intake = 1.000 everywhere** (skills no-op) — trivial; cheapest/fastest lane wins.
- **cv-review is the portfolio weak spot** — every cheap lane is mediocre (best 0.906 gemini-flash bare; with-skills lanes top out at gpt+skills 0.833). Candidate for a stronger lane or a better-targeted skill.

## 2b) Gemini AGENTIC + skills (production-faithful frame) — NEW 2026-06-22
The live fleet runs Gemini AGENTICALLY (thiaaaa-59 lanes B/C): skills mounted as files under `.paperclip/skills/`, small prompt, `agy --print --dangerously-skip-permissions` — NOT the 65k single-shot concat that breaks agy print mode. `variants_agentic.py` measures that exact frame; scored on the bare rubric by the blind claude-opus judge, recorded under the isolated `agentic-variant:` ledger namespace (never mixed with single-shot `variant:` or the bare leaderboard). Pooled n=5–7/cell:

| role | model | bare (best) | agentic AF-only | **agentic AF+skills** | ΔSkills | read |
|---|---|---|---|---|---|---|
| **cv-review** | gemini-flash (med) | 0.906 | 0.969 (n6) | **0.960 (n7)** | −0.01 | ✅ clears 0.906 decisively; **zero derails** |
| cv-review | gemini-flash-low | 0.895 | 0.928 (n6) | 0.778 (n7) | −0.15 | ⚠ derail-prone w/ skills (2/7 → 0.0 & 0.65) |
| **book-chapter** | gemini-flash-low | 0.955 | 0.958 (n5) | **0.955 (n5)** | −0.00 | ✅ confirms 0.955 holds in the real frame |
| book-chapter | gemini-flash (med) | 0.934 | 0.811 (n5) | 0.855 (n5) | +0.04 | ⚠ derail-prone here (one 0.25 @242s) |
| **content** | gemini-flash-low | 0.876 | 0.893 (n7) | **0.915 (n7)** | +0.02 | ✅ agentic LIFTS above bare 0.876 |
| content | gemini-flash (med) | 0.860 | 0.908 (n6) | 0.905 (n6) | −0.00 | ✅ agentic lift over bare |

**Three takeaways:**
1. **The agentic frame scores gemini HIGHER than single-shot for cv-review & content** — because it matches how Gemini is actually used. The single-shot exclusion wasn't just a gap; it was UNDER-counting gemini. cv-review gemini-flash agentic 0.96 vs bare 0.906; content gemini-flash-low agentic+skills 0.915 vs bare 0.876.
2. **agy print mode occasionally DERAILS** (off-task/empty answer at high wall-time → 0.0–0.65). It's role×variant-specific: **flash-medium derails on book-chapter (~1/5); flash-low derails on cv-review-with-skills (~2/7).** Pick the variant that's clean on the target role. The live antigravity_local adapter has run-recovery/retry the bench lacks, so production derail impact is likely lower — but lane choice should still favor the clean variant.
3. **Skills are ~neutral agentically** for these roles (ΔSkills −0.01..+0.04) — same as the claude/grok single-shot finding. The agent-file carries the lift; mounting the full skill set adds little and can raise derail risk (flash-low cv-review).

## 3) Lane-hardening implications
- **cv-review (portfolio weak spot):** ✅ **LOCKABLE as gemini-flash (medium), agentic.** Agentic AF+skills 0.960 / AF-only 0.969 (n=6–7) clear the 0.906 bar by ~0.06, with **zero derails** — the weak spot closes with a FAST lane, **no need to escalate to a stronger non-fast model.** Do NOT use gemini-flash-low (derails to 0.778 with skills). Skills neutral — the cv-review agent-file does the work.
- **content (Media drafter):** bare put gpt-5.4-mini (0.899)/claude-haiku (0.896) ahead of gemini-flash-low bare (0.876) — but **in the real AGENTIC frame gemini-flash-low+skills = 0.915 and gemini-flash = 0.905** (n=6–7), edging the bare cheap-lane leaders. → **The Media-Drafter=flash pick is MORE defensible than the bare leaderboard implied** — measured the way Gemini actually runs, it's competitive-to-best. gpt-5.4-mini+skills / claude-haiku remain valid alternatives if flash quota is tight.
- **book-chapter (Books drafter):** ✅ **LOCK Books-Drafter = gemini-flash-low.** Agentic AF+skills 0.955 (n=5) exactly matches the bare 0.955 → the lane holds in the production frame. Do NOT swap to flash-medium (0.81–0.86, derail-prone here). grok-4-fast (0.950) is the strong non-gemini fallback.
- **video-hook / summarize-extract / ops:** claude-haiku is the clean winner; skills not needed.
- **designer:** grok-4.1-fast bare (0.967) is best and skill-free; if forced to haiku, give it skills (+0.122).
- **social-post:** grok lanes (0.921) — skill-free.

**Caveats:** gpt-5.4-mini with-skills is n≈3 (refresh when the lane completes ~today); "winner" margins inside ~0.01 are ties (judge noise). Base numbers are ≥5-sample decision-grade. Gemini with-skills is now measured AGENTICALLY (§2b, n=5–7) — a DIFFERENT methodology from the single-shot `variant:` cells, so compare gemini agentic vs gemini bare, not gemini-agentic vs claude/grok-single-shot. agy print mode has a real ~15–30% derail tail on some role×variant combos (means include the derails; clean-answer quality is ~0.95+). Run: `python3 variants_agentic.py --roles <role> --models gemini-flash,gemini-flash-low --max-tasks-per-role 5 --cells current:none,current:all` (quota-bounded, halts on agy 429/auth; honors the `.tsbc-power.json` gate).

*Generated by MC from benchmark/ledger/results.jsonl. Refresh: re-run the analysis once the gpt-5.4-mini with-skills lane hits 5/cell.*
