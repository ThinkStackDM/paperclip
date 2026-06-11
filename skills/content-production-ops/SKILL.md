---
name: content-production-ops
description: ThinkStack Media pipeline for faceless YouTube content production with YMYL gating. Use for "10-video launch hitlist" work, channel video scripts ("Cashflow Compass video #N", "V1 script"), compound-primitive build/verification issues ("[CC CP]", "operational render-gate", "bake-off"), or YMYL linter/sign-off work. Encodes the hitlist bar, the script→lint→sign-off→render state machine, and the hard rule of splitting runner-independent code slices from runner-gated render verification.
---

# Content Production Ops

ThinkStack Media runs three faceless channels (Stack Lab — AI tools; Cashflow Compass — personal finance, YMYL-gated; Vault Cases — history/cold cases, archive-license-gated). The production pipeline exists and is partially built; **the #1 historical failure is batching runner-dependent render verification into the same issue as buildable code** — nearly every "operational render-gate" issue sat blocked for days on the missing GHA self-hosted runner while the code work inside it was finishable. Structure work so that never happens again.

## The split rule (THIAAAAA-53 vs THIAAAAA-54 precedent)

Any compound-primitive or pipeline task divides into:
- **In-repo code slice** — modules, adapters, unit tests, fixtures, sample scripts, typecheck. Needs no runner. Ship it `done` on its own issue.
- **Operational render verification** — actual captures, sample MP4s, TTS sync, acceptance renders. Runner-gated. Its own issue, `blocked` on the infra issue with the owner named.

If you're assigned a combined issue, split it as your first act and say so. The runner spec of record (THIAAAAA-52, still the gating infra): GHA self-hosted, Xvfb 1920x1080x24, ≥8GB, OpenVoice v2 + WhisperX + ffmpeg + headless Chromium. TODO: confirm runner provisioning status before relying on it — it was blocked at last mining.

## Hitlists ("10-video launch hitlist — <Channel>")

Per ContentStrategist's bar: each of the 10 videos needs working title, hook (first 8 seconds), structure outline, thumbnail concept, target keyword(s) or trend angle — and each title must be defensible on clickability, retention shape, search demand, and channel narrative arc. Never ship generic listicle titles with no hook differentiation. YouTube reused-content/policy rules are hard constraints. Deliverable = issue document linked from the task comment.

## YMYL gate (Cashflow Compass — mandatory before any finance render)

The chain is policy → linter → sign-off → render, all already built:

1. **Policy**: `ymyl-policy-cashflow-compass` doc (THIAAAAA-10). No finance video ships without passing it.
2. **Script contract**: YAML frontmatter + body with declarative beat/overlay/disclosure structure (`ymyl-wiring-design` §1, THIAAAAA-29). On-screen claims are declared metadata, not OCR'd after render.
3. **Linter**: `packages/ymyl-linter` (`@thiaaaa/ymyl-linter` v1.0.0, THIAAAAA-42) — 16 detectors mapped rule→policy section, hard-fail-only rule pack v1 pinned to policy revision `917f6883`. Output is lint-result JSON with a `scriptHash` idempotency key.
4. **Sign-off state machine**: `draft → linted → {release-to-render | return-to-strategist | pending-ceo-approval}` with a hard render-gate invariant. CEO sign-off goes through Paperclip `request_board_approval` carrying `metadata.ymylSignOff.{scriptId,scriptHash,linterVersion,policyVersion,findingIds}`. A script revision purges the prior pending approval (no ghost approvals).
5. **Audit log**: append-only JSONL.

Chart-and-narrate renders additionally go through `packages/chart-and-narrate`: `RechartsEngineAdapter` (primary) / `ChartJsEngineAdapter` (fallback) via `selectEngine(winner)`, `YmylLinterAdapter` port, `LintAttestation` render-attestation, plan-hash + live `policyRevisionId` compose cache, and the six composer render-stage gates.

## Channel-specific gates

- **Cashflow Compass**: YMYL gate above. Every numeric overlay carries a `data-cite` (`Publisher — Date`) value.
- **Vault Cases**: archive-licensing is a **hard-fail** gate — period reconstruction work without cleared archive licenses does not render.
- **Stack Lab**: UI walkthroughs are synthesized via the Playwright/Puppeteer bake-off primitive; OAuth/tenant wiring is a board handoff (THIAAAAA "Stack Lab OAuth token mint" pattern).
- TTS of record: **OpenVoice v2** (XTTS-v2 dropped per tech-stack v3 §2). Stack is sub-only / multi-account constrained (tech stack v2/v3 re-picks) — don't reach for paid APIs the budget guardrail rules out.

## Acceptance verdicts

Sample renders (e.g. the 3-chart CC sample) close with an explicit **ContentStrategist no-slop verdict** against the rubric — not just "renders fine". Bake-offs produce a `winner.yaml` and the loser stays as fallback adapter, not deleted.

## Known failure points

- Render-gated issues left `in_progress` with no live continuation → watchdog churn. Block on the infra issue with owner, or split (rule above).
- Orphaned blockers with no assignee (THIAAAAA-42 was found blocking -43 with nobody assigned) — assign the blocker back to its creator immediately.
- Cancelled-duplicate churn: several CP issues were re-cut 3–4 times under different scopes before the slice/verification split stabilized them. Reuse the THIAAAAA-53 scope shape instead of inventing a new cut.

## References

- `references/pipeline-evidence.md` — issue trail for the YMYL chain, compound primitives, and the runner gate.
