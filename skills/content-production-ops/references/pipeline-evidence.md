# Media production evidence (ThinkStack Media, company d71c9e82)

Identifiers are THIAAAAA-*.

## Channel slate + hitlists
- Channel slate: 3 briefs (Stack Lab, Cashflow Compass, Vault Cases) — done 2026-05-27.
- Hitlists: THIAAAAA-19/20/21 ("10-video launch hitlist — Stack Lab / Cashflow Compass / Vault Cases") — all done. Hitlist bar quoted from ContentStrategist AGENTS.md (working title, 8-second hook, structure, thumbnail concept, keywords; defensible on clickability/retention/search/arc; policy rules hard constraints).
- Individual video scripts (CC #1–#3, Stack Lab V1, CC V1, Vault Cases V1) — ALL still blocked at mining time; scripts gate on the YMYL/render chain and runner.

## YMYL chain
- THIAAAAA-10 — YMYL editorial policy for Cashflow Compass ("gating: must exist before first finance video ships") — done.
- THIAAAAA-29 — render-gate wiring design (`ymyl-wiring-design` doc): §1 script input contract (YAML frontmatter, declarative beats/overlays/disclosures), §2 16 detectors rule→policy mapping, §3 lint-result JSON + scriptHash, §4 sign-off state machine with hard render-gate invariant, §5 append-only JSONL audit log. CEO approval comment explicitly ratified: declarative metadata over OCR; sign-off via `request_board_approval` with `metadata.ymylSignOff.{scriptId,scriptHash,linterVersion,policyVersion,findingIds}`; revise-event purges pending approval.
- THIAAAAA-42 — `@thiaaaa/ymyl-linter` v1.0.0 implemented (packages/ymyl-linter, 10 TS files, 1235 LOC, fixtures, smoke). Rule pack v1 doc ported verbatim (hard-fail-only, pinned to policy revision `917f6883-182e-4687-a030-fb1996a664d2`). Also the orphan-blocker lesson: found blocking -43 with no assignee.
- THIAAAAA-34 — compound-primitive CC spec (§3 module contract, §2.4 Chart.js fallback, §3.5 YmylLinterAdapter contract).

## Compound primitives + the split rule
- THIAAAAA-53 — "[CC CP] In-repo code slice" — DONE: `packages/chart-and-narrate` (Recharts primary + ChartJs fallback + selectEngine, buildDataCite `Publisher — Date`, InMemoryComposeCache plan-hash + policyRevisionId, LintAttestation, six composer render-stage gates), 18 unit tests, live linter green.
- THIAAAAA-54 — "[CC CP] Operational render verification (runner-gated)" — BLOCKED: 18 captures + winner.yaml + 3 sample MP4s + OpenVoice v2/WhisperX sync + CS verdict.
- THIAAAAA-52 — runner infra: GHA self-hosted, Xvfb 1920x1080x24, ≥8GB, OpenVoice v2 + WhisperX + ffmpeg + headless Chromium — BLOCKED at mining (the single gate behind all operational verification).
- Churn evidence: "Compound primitive — Cashflow Compass chart-and-narrate" and Vault Cases / Stack Lab equivalents were created/cancelled 3–4 times (2026-05-28) before the slice/verification split stabilized.
- "CC 3-chart sample — ContentStrategist no-slop verdict (rubric + Layer-A/B staging)" — blocked; verdict-close pattern.
- Stack Lab CP — "operational render-gate: bake-off harness + 30s sample" blocked; "Stack Lab UI walkthrough (Playwright/Puppeteer bake-off)" done.
- Vault Cases CP — "period reconstruction + archive-licensing pipeline" done at design level; archive-licensing hard-fail named in multiple titles.

## Stack decisions
- "Tech stack v2: re-pick under sub-only + multi-account constraints"; "Channel-1 brief — TTS engine line edit (XTTS-v2 → OpenVoice v2)" per tech-stack v3 §2.
- CEO budget guardrail v1.1 applied to monetization-roadmap + affiliate-slug-convention docs; `thiaaaa-budget-guardrail` memory favors minimum agent footprint.

## Failure-shape stats (mined 2026-06-11)
- 125 domain issues; the blocked set is dominated by scripts + operational render gates (runner) and the analytics dashboard. The buildable slices (linter, chart-and-narrate, walkthrough bake-off, YMYL wiring) all completed.
