---
name: forge-studio-ops
description: Create, inspect, package, verify, hand off, and track governed Forge Studio brand assets. Use for logo or identity generation, brand packs, platform/social/print outputs, Forge Studio projects or releases, brand-asset custody, approved-asset consumption, usage registration, drift audits, release integrity, version comparison, or last-known-good recovery planning. Use this instead of legacy brandsuite forge whenever work may become canonical.
---

# Forge Studio Ops

Use the `forge-studio` CLI as the single machine contract. It invokes the same renderer, outlined type, QA rules, schemas, and version as the visible app; do not recreate Forge artwork with a separate script.

## Start safely

1. Run `forge-studio doctor --json`.
2. Stop if `ok` is false or the CLI, service, and renderer versions differ.
3. Run `forge-studio approved list --json` before creating anything. Reuse an Approved release when it already satisfies the task.
4. Never use `brandsuite forge` for a new canonical asset. Treat it as compatibility-only.

Read [references/cli.md](references/cli.md) when choosing commands, interpreting failures, or preparing automation.

## Choose the workflow

### Consume an existing brand

1. Find the Approved pointer with `forge-studio approved list --json`.
2. Find its immutable release with `forge-studio releases list --brand <slug> --json`.
3. Verify before use with `forge-studio release verify <brand> <entry> --json`.
4. Record the handoff with `forge-studio release acknowledge <brand> <entry> --json`.
5. Copy only the required derivatives to the consumer's durable project location; do not edit the release package.
6. Register the real consumer with `forge-studio usage register <brand> --consumer <name> --type <type> --location <permanent-path-or-url> --json`.
7. Run `forge-studio drift audit <brand> --json` and report any missing, outdated, compromised, or untracked state.

Do not claim brand usage from a chat attachment, temporary render folder, prompt, or LLM transcript. Evidence requires an immutable release plus a usage-ledger record.

### Create or improve a brand

1. Inspect eligible custody sources with `forge-studio sources list --status Candidate --eligibility Brandmark --json`.
2. Inspect the source project with `forge-studio project show <id> --json`.
3. Clone it to a new Draft; never patch the operator's project in place:

   `forge-studio project clone <source> <new-id> --name "<review name>" --version <semver> --patch <json> --json`

4. Keep the patch limited to design intent: name, brand copy, brief, seed, palette, identity recipe, brand world, output pack, and stage. The CLI rejects governed status/history fields.
5. Build through the production renderer:

   `forge-studio candidate build <new-id> --pack complete --version <semver> --json`

6. Require `status: Candidate`, matching versions, and `verification.ok: true`. Then independently run release verification.
7. Inspect `review-sheet.svg`, `context-board.svg`, dark/light/mono masters, wordmark, monogram, compact lockup, and representative platform outputs at actual size.
8. Prepare a verified ZIP only after visual review.

Candidate is a review state, not approval. Preserve meaningful rejection reasons and lessons so the next revision learns rather than merely changes.

## Respect the operator boundary

Never perform or work around these actions as an agent:

- Approve a Candidate or advance the known-good pointer.
- Change source custody status or ban/unban a file.
- Restore a prior Approved release.
- Publish to X10/TSKB permanent custody.
- Modify files inside an immutable release directory.
- Register Candidate or Draft assets as live usage.

Ask the operator to review in the Forge Studio app. State clearly whether the result is Draft, Candidate, Approved, locally verified, or permanently published. If X10 is unavailable, leave the verified release local and say so.

## Control drift and recovery

- Treat `approved/<brand>/current.json` as the local last-known-good pointer.
- Treat the release directory and `integrity.json` as immutable evidence.
- Treat `usage-ledger.json` as evidence of real deployment outside chats.
- Run a drift audit before and after replacing assets in a consumer.
- Compare Candidate and Approved releases before upgrading a live consumer.
- Restore through the app; never copy older files over newer files by hand.
- Save learning in the project revision and release `process-memory.json`, `decisions.json`, and `lessons.md`.

## Handoff

Report the project ID and revision, Candidate release entry, asset version, integrity count, visual QA result, verified ZIP path if created, and any unresolved custody or X10 condition. Link the release folder or review sheet when the environment supports local links.
