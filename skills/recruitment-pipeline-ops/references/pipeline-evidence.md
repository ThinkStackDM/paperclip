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

## Render step — HOUSE RENDERER (codified 2026-07-18, mandatory)
The CV-polish/application render step is `~/scripts/tsr/cv-polish-render.py <in.md> <out.pdf> [--letter]`
— codified from the operator-approved v4 reference (TSR-3970). House style: centered Georgia name
header, gray tagline, single contact line (location · email | phone | linkedin),
small-caps hairline sections, entry lines "**Role — Company | YYYY–YYYY**" render with right-aligned
dates, tight verb-led bullets. Deliveries and internal applications BOTH use this script — ad hoc
pandoc/manual rendering is drift. SoftCo metrics ground truth: demand +30%, CSAT +15%, backlog −20%
(memory: davin-softco-canonical-metrics; the 07-08 v4 reference PREDATES the correction — numbers
there are stale, layout is canon).

## Humanise pass — MANDATORY before render (added 2026-07-18)
Every CV/cover/outward doc runs the `humanise-copy` skill BEFORE cv-polish-render.py: strip
drafting scaffolding sections (Role Alignment / Fit Note / Match Flags — never rendered),
kill template phrases (see the skill's kill-list), vary rhythm, keep facts and approved
metrics untouched. Render without this pass = drift.

## Letter-source contract for cv-polish-render.py (learned 2026-07-19, from a rejected application)
- Cover-letter markdown must start DIRECTLY with the date line (e.g. `19 July 2026`). NO name line, NO contact block, NO addressee lines — the renderer injects the centered name itself, and any leading non-heading lines get eaten into a centered "contact" blob (the spaced-out-address defect the operator rejected).
- CV markdown header = `# Name` + ONE contact line (`email | phone | linkedin`). A stray second phone/address line renders as a spaced body paragraph = instant reject.
- Role entries MUST be `**Role — Company | YYYY–YYYY**` before render. `### Co | Role | dates` H3 packet format is NOT auto-converted; normalize first (this slipped through on one application while another got the normalizer).
- MANDATORY: pixel-verify every render against the approved reference pair before attaching (rasterize via magick, LOOK at it).

## CV canon spec (locked by operator audit 2026-07-19 — the reference CV is the canon)
- Header: `# Name` + ONE contact line. Then a BOLD role-tailored positioning line (`**X | Y, Z**`) + an UNTITLED summary paragraph — never a "## Professional Summary" heading, never a "Core Strengths" section.
- Entries: `**Company — Role | YYYY–YYYY**` (Company FIRST, em-dash, en-dash year range). Never company-as-section-header, never "2024 to 2025".
- SoftCo MUST carry the canonical metrics bullet: "Improved CSAT by 15% and reduced backlog by 20% while support demand grew 30%". A CV omitting it is drift even though it cites nothing false.
- Earlier career = ONE sentence bullet under `**Earlier career | 2010–2015**`. Education entries comma-separated, no pipes.
- Every application's CV = this structure with a role-tailored positioning line, summary, and bullet angle. 2026-07-19 audit result: only the reference CV was canon; the rest were rebuilt (v2/v3 on their issues).

## Unified render engine (operator order 2026-07-19)
- The customer cv-render engine (scripts/cv-render/) now carries the house canon as template id `house-canon`, and it is the DEFAULT customer template. Entry order ruling: Company — Role everywhere (operator-locked).
- Personal applications still render via ~/scripts/tsr/cv-polish-render.py until the migration issue completes; both must match the CV canon spec above. Any format change goes into BOTH or it is drift.
