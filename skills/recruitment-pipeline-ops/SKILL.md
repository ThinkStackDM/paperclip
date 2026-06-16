---
name: recruitment-pipeline-ops
description: ThinkStack Recruitment procedures for the candidate pipeline and the $29 CV-polish wedge. Use for candidate issues ("Onboard first candidate", "intake follow-up", "questionnaire nudge", "job market scan", "Route ... questionnaire reply") and wedge orders ("[PHASE-0-WEDGE] CV polish order <id>"). Encodes the intake questionnaire flow, the profile gate, the SLA clock rules, the least-privilege comment-routing pattern, and the delivery-SOP stage owners for paid orders.
---

# Recruitment Pipeline Ops

Two revenue lanes: the **candidate pipeline** (place candidates; currently first candidate = Davin McGrath, who is also the board user) and the **PHASE-0-WEDGE** ($29 CV polish, Stripe-fed). Both run on documents-of-record plus strict issue-ownership routing — most wasted heartbeats in history came from agents trying to comment on issues they don't own.

## Candidate pipeline (THIAA-14/15 pattern)

Each candidate gets a **parent issue** ("<Name> — recruitment") holding the `candidate-profile` document, with stage children under it.

1. **Intake**: read the CV in full, pre-fill the profile against the `candidate-profile-schema` (THIAA-7), and document every gap. Draft the intake questionnaire (Book-of-record shape: 22 questions / 6 parts — eligibility & logistics, preferences, career goals in the candidate's own words, per-role STAR deepening on top 3 roles, two narrative framings; don't re-ask CV-obvious facts; no DOB / government IDs).
2. **CEO spot-check before sending** — questionnaire goes out only after CEO clears it.
3. **Delivery channel**: when the candidate is the board user, post the questionnaire as a comment on the parent candidate issue — the issue thread is the canonical channel, no external email. Start the **48-business-hour SLA clock** in the message and cite the SLA policy doc (THIAA-8).
4. **Profile gate**: Work Authorization + Preferences + Career Goals sections must be filled before downstream work (job market scan, submissions) starts. The gate is what blocked the Davin lane for 13+ days — nudge on SLA breach, don't silently wait.
5. **On reply**: route answers to **CandidateIntakeSpecialist** to fold into the candidate-profile doc; gate clears; the job-market-scan child wakes via `issue_blockers_resolved`.
6. **Submissions** (Stage 9): submission records have tightened requirements per the Stage-9 workflow issue — TODO: read the workflow doc on THIAA before first real submission; no submission has run end-to-end yet.

### The routing pattern that actually works (THIAA-464/466/469)

Least-privilege blocks comments on issues you don't own, and checkouts of owned issues return 409 (never retry). When you need a comment posted on someone else's issue:
- Create a **child issue assigned to the owner** (or RecruitmentManager) carrying the full draft text to post.
- Build the continuation chain explicitly and write it in the comment, e.g.: candidate replies on parent → owner (CEO) resolves the routing issue → blocked stage issue wakes → CandidateIntakeSpecialist folds answers → gate cleared → next stage wakes.
- `ask_user_questions` is multiple-choice-only — unsuitable for free-text intake; don't reach for it.

## CV-polish wedge orders ("[PHASE-0-WEDGE] CV polish order <id>")

The stage contract is the **`delivery-sop` document on THIAA-47** — read it before acting; summary:

1. **Trigger**: order issue minted by the Stripe webhook (THIAA-33). Payment confirmed ≠ clock running: the **SLA clock starts on intake-form submission** (CV upload + target role), not on payment. An order without a form stays `blocked` pending the customer, with the intake URL (`/cv-polish/intake?session_id=...`) in the thread.
2. **Intake review** — RecruitmentManager, ≤30 min: PDF sanity check, create candidate-snapshot doc; clarification loop pauses the SLA.
3. **Draft pass** — ApplicationWriter, **Haiku enforced** (MC condition on THIAA-32), ≤90 min, child-issue pattern; deliverables: CV .docx + .pdf, cover letter, token telemetry.
4. **QA pass** — RM, ≤45 min: PASS/REVISE with specific feedback; max 1 revision cycle on Haiku; second fail escalates to CEO.
5. **Final polish + A/B** — orders 1–5 run dual Haiku/Sonnet child issues; RM picks the winner.
6. Refund/quality-bar policy is published (THIAA landing-page policy issues) — apply it rather than improvising on an unhappy order.

Stripe is **test mode only** until the board flips live creds ("build wedge launch-ready in Stripe test mode (no live creds)") — never assume live billing.

## Known failure points

- Profile-gate stalls: questionnaire unanswered 13+ days with no nudge until 2026-06-10. Nudge at SLA breach via the routing pattern, and re-nudge on a stated cadence (TODO: cadence not yet board-ratified — propose one in the nudge issue).
- Comment/409 walls burning heartbeats (THIAA-464 tried comment + checkout before falling back to the child-issue route — go straight to the route).
- Wedge order THIAA-488 blocked on customer form — correct state, but make the blocked-on-customer status and intake URL explicit so watchdogs don't churn it.

## References

- `references/pipeline-evidence.md` — issue trail for the Davin lane and the wedge build-out.


<!-- TOOLS-2026-06 -->
## Local tools
- OCR scanned/image resumes and docs with `tesseract` (e.g. `tesseract cv.png out` → `out.txt`) before parsing.
