# Five priorities for this week (before limits reset) — reflection

Written 2026-06-15 overnight. Context: the platform/model/skill layers are now in good shape
(model selection locked, redundancy + failover sisters in place, 14 new role-agents, self-improvement
loop fixed, 8h Claude-window automation live, rebalance done). The remaining leverage has moved off
"make the machine better" and onto "make the machine *earn*." Ranked by impact per token/effort.

## 1. Unblock ONE real revenue credential (KDP **or** Etsy) — highest leverage by far
**Why:** the entire portfolio records **$0** (`finance_events` empty). Every revenue pipeline is
*built* (KDP publish flow, Etsy publish scripts, KISS AdSense plumbing, the CV-polish Stripe wedge)
and stalls at the same wall — live credentials/human auth. This is the single thing only you can do,
and it converts a whole pipeline from rehearsal to real. Don't do all of them — do **one**, end to
end, and let a company actually sell something this week. Books (KDP) or Etsy (DP) are closest to
shippable.
**What I need from you:** the live auth for one channel. Then I wire the last mile + we ship a real unit.

## 2. Stand up the finance/analytics feedback loop
**Why:** `analytics-finops` skill + the Ledger agent exist, but nothing records outcomes yet, so the
portfolio is flying blind — we literally can't tell what's working. Even *manual* outcome recording
(a finance_event per sale/payout/refund) creates the feedback substrate every other improvement
depends on. Pair this with #1: the moment one channel earns, we measure it.
**What I'll do:** wire Ledger to record finance_events + produce a weekly per-company P&L, once there's a real number to record.

## 3. Confirm the self-improvement loop actually closes
**Why:** I fixed the Sleep→Dream handoff (the weekly retro had been *failing for days*, dead-ending
the reflection→memory→skill pipeline). The fix is in but unproven — the next weekly retro (Sunday)
is the first real test. If it runs green and produces a real insight/skill, the fleet starts
compounding; if not, we debug it while it's fresh.
**What I'll do:** watch the next retro run; verify it reads the summaries + commits a real output.

## 4. Register + gate this skill pack (and wire the 2 MCPs)
**Why:** capability authored but unused = no value. Run the knowledge-style skills (CRO, A/B,
pricing) through the #16 skillbench keep/drop gate + attach the runbooks (checklists, platform
research) broadly. Add the 2 free MCPs (Playwright for deployed-site visual QA, shadcn for UI) — the
Playwright one closes the "we ship sites we can't see" gap directly.
**What I'll do:** on your review of `skill-pack-review/`, register the approved skills + wire the MCPs (needs your nod on the `hermes mcp add` calls).

## 5. Harden the platform single-point-of-failure
**Why:** tonight a fleet engineer editing `server/src` briefly removed `run-gate.ts`, which
**crash-looped the entire instance** (all 7 companies down ~2 min until KeepAlive recovered it once
the file returned). One agent's in-progress edit to the live `tsx watch` source can take down the
whole platform. That's the biggest structural risk we have now.
**Options to discuss:** platform/`server/src` changes land on a branch + pass a smoke-gate before the
live process picks them up; or the live server runs from a built/pinned copy while agents develop
against a worktree; or restrict who can touch `server/src`. Worth a deliberate fix this week.

---

### Not on the list (deliberately)
More model tuning, more agents, more redundancy — all diminishing returns now. The constraint is
**output → outcome**, and four of the five above attack exactly that. #5 is the one "keep the lights
on" item that protects everything else.
