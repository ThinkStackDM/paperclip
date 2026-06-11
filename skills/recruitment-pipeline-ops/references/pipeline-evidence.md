# Recruitment evidence trail (ThinkStack Recruitment, company cefbbf68)

Identifiers are THIAA-*.

## Candidate pipeline (Davin McGrath lane)
- THIAA-7 — candidate workflow + `candidate-profile-schema`.
- THIAA-8 — 48-business-hour candidate response SLA policy (doc: `policy`).
- Stage-9 issue — "Workflow: tighten Stage 9 submission record requirements" (done 2026-05-26; contents not read during mining — hence the TODO in SKILL.md).
- THIAA-14 — intake build+send: CV read in full (8 roles, 3 qualifications), profile pre-filled with gaps flagged, 22-question/6-part questionnaire (`intake-questionnaire` doc), CEO spot-check cleared, questionnaire posted to THIAA-15 thread with SLA clock line; cross-post handled via follow-up issue THIAA-16 when THIAA-15 was checked out.
- THIAA-15 — parent "Davin McGrath — recruitment" with `candidate-profile` document (in_review at mining).
- THIAA-464 — "intake follow-up: questionnaire unanswered 13+ days, clear profile gate" (blocked): comment on THIAA-15 rejected (least-privilege, Athena owns), checkout 409 (no retry), `ask_user_questions` rejected (multiple-choice only) → created THIAA-466 (RM posts the nudge draft) → done 2026-06-10T19:30 (comment ceae2919) → THIAA-469 (Athena routes Davin's reply → CandidateIntakeSpecialist). Continuation chain quoted in SKILL.md.
- THIAA-465 — "job market scan: Ireland, Senior Technical Support / IT Operations Manager" (blocked on the profile gate).

## PHASE-0-WEDGE ($29 CV polish)
- Epic: "EPIC: Ship Phase-0 Wedge ($29 CV polish)" + PHASE-0-WEDGE label sweep.
- THIAA-33 — Stripe Payment Link + webhook + per-$1 telemetry (blocked at mining — Stripe live creds are board-gated; test-mode build done via "Sprint: build wedge launch-ready in Stripe test mode (no live creds)").
- THIAA-47 — `delivery-sop` document (done): 7 sections + 2 additions; stages/owners/limits as summarized in SKILL.md (RM ≤30min intake, ApplicationWriter Haiku ≤90min draft per THIAA-32 MC condition, RM ≤45min QA, 1 revision max then CEO, dual Haiku/Sonnet A/B for orders 1–5).
- THIAA-488 — "[PHASE-0-WEDGE] CV polish order 21915704" (blocked): session `cs_test_THIAA472_demo_1781121915704`, $29 paid, awaiting intake form; SLA explicitly NOT started until form submission; intake URL pattern `/cv-polish/intake?session_id=...`; CV arrives as signed Vercel Blob URL.
- Landing/policy issues: "/cv-polish landing page on existing Next.js app" (done), "Order intake form + CV upload + secure storage" (done), "Refund + Privacy + ToS policies (landing-page ready)" (in_review), "Draft refund + quality-bar policy" (done), "Acquisition playbook + first 3 channels" (in_review).

## Volumes / failure shapes (mined 2026-06-11)
- 97 domain-ish issues, but the genuine domain set is ~35 (candidate lane + wedge); the rest is MC/comms. Both lanes have never completed end-to-end: candidate lane gated on questionnaire answers; wedge gated on Stripe live creds + first real order. Failure points: least-privilege walls, profile-gate stall (13+ days, no nudge cadence), board-gated payments.
