---
name: make-a-skill
description: >
  How to create, benchmark, and roll out an agent skill that actually improves output —
  and how to avoid skills that quietly hurt. Use whenever a recurring class of task gives
  inconsistent output, a cheap lane underperforms, or agents keep getting a system-specific
  procedure wrong. Covers what makes a good skill, the #16 skillbench keep/drop gate, the
  rule that skills help weak/cheap lanes but can distract strong ones, and how to register
  and attach it to the right agents.
---

# Make a Skill

A skill is a vetted playbook injected into an agent's prompt. A good one raises output
quality enough to justify the tokens it costs. A bad one is noise — or worse, it distracts
a model that already knew the answer. This is how to build ones that earn their place.

## When to make a skill
- A recurring task class produces inconsistent or sub-par output.
- A cheap/fast lane underperforms a strong lane on work you run a lot — a skill can close
  most of that gap for a fraction of the cost.
- Agents keep getting a *system-specific* procedure wrong (our runbooks, gates, paths).

Do **not** make a skill for a one-off, or to restate what a capable model already does well.

## Two kinds of skill — this decides who gets it
1. **Knowledge skill** — teaches a method/craft the model may not apply by default (e.g.
   book-craft: hook-first, concrete specifics, kill AI-tells). These help **weak/cheap lanes
   most** and can be **neutral-to-harmful on strong models** that already nail the task
   (a forensics skill once cost a strong model −0.17). Scope them to the lanes below the bar.
2. **System runbook** — encodes OUR procedures a model can't know from training (execution
   semantics, board gates, the fallback protocol, paths). These go on **every agent that does
   that work, regardless of model strength** — removing them breaks ops.

## Write it tight
Concrete over generic; if a line could appear in any skill, cut it. Lead with the rule, then
the why. Keep only what changes behaviour — you pay real tokens for it on every call.

## The benchmark gate — decide keep/drop BEFORE rollout
Never ship a skill on vibes. Validate in `~/paperclip/benchmark` (#16 skillbench):
1. Add a pair to `skillbench/pairs.json`: a deliberately **under-specified task** (its bare
   prompt omits the method your skill teaches) + a **rubric that rewards that method**.
2. Put the skill in `skillbench/candidate-skills/<name>.md`.
3. Run `python3 skillbench.py --pairs <id> --models <cheap+strong> --reps 2`.
4. **KEEP** if mean lift ≥ +0.03, the lift justifies the token cost, and it does **not** hurt
   the strong lane. Otherwise DROP, or scope it to only the lanes it helps.
5. Results auto-record to the shared ledger. **Trust rule:** if the ledger has ≥3 results in
   30 days for this skill/class, trust the pooled median; else benchmark yourself first.

## Roll it out (after KEEP)
- **Company-specific** skill (your own domain runbook) → key `company/<companyId>/<slug>`; you
  own it.
- **Shared / platform** skill (used across companies, or it touches Paperclip itself) → that's
  TSMC's call. Propose it to Mission Control; don't self-publish a `paperclipai/paperclip/*`
  skill. (See `escalate-platform-work-to-tsmc`.)
- Register: write `SKILL.md`, create the `company_skills` row(s), add the ref to the
  `desiredSkills` of the agents that need it — the lanes below the bar for knowledge skills,
  all relevant agents for runbooks. Changes sync on the next heartbeat.

## Maintain
Re-benchmark when the model lineup changes. Drop a skill that stops earning its tokens — one
that helped last month's cheap model may be dead weight on this month's.
