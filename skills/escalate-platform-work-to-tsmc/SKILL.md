---
name: escalate-platform-work-to-tsmc
description: >
  Scope rule for non-TSMC companies: build YOUR product on Paperclip, but do not modify
  Paperclip the platform. If a task requires changing the platform itself, stop and escalate
  to TSMC (Mission Control). Use on any task that drifts toward platform/runtime/skill-infra
  changes.
---

# Platform work → escalate to TSMC

Your company builds its own product **on** Paperclip. TSMC owns Paperclip the platform.

## Don't do platform work
Do **not** modify Paperclip itself — the agent runtime, heartbeat, adapters, server, schema,
plugins, the shared `paperclipai/paperclip/*` skills, or the benchmark / skill infrastructure.
If a task needs any of that, **stop and raise it with TSMC / Mission Control** (open an issue
or directive to TSMC and link exactly what you need) rather than changing the platform yourself.

## What you CAN do
- Build and ship your own product (trading bot, sites, books, media, recruitment, etc.).
- **Create and manage your own company's agents** — spin up sisters and role agents with
  `paperclip-create-agent`. That's yours.
- Create **company-specific** skills for your own domain (`company/<id>/<slug>`).

Rule of thumb: building *on* Paperclip is yours; changing *Paperclip* is TSMC's.
