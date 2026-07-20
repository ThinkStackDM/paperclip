# Forge Studio CLI reference

## Contract

- Version: `1.0.2` (feature-frozen `1.0.x` adoption line)
- Command: `/Users/glad0s/.local/bin/forge-studio`
- Default service: `http://127.0.0.1:4681/`
- Canonical source: `/Users/glad0s/scripts/brand-suite/forge-studio`
- Full runbook: `/Users/glad0s/scripts/brand-suite/forge-studio/OPERATOR-AND-AGENT-RUNBOOK.md`
- Local immutable releases: `/Users/glad0s/scripts/brand-suite/forge-studio/library`
- Machine output: add `--json`; errors are JSON on stderr.
- The CLI may start its matching local service. It fails closed on version mismatch.
- Candidate rendering uses a throwaway headless browser profile and the visible app's renderer.

## Commands

```text
forge-studio version --json
forge-studio doctor --json
forge-studio projects list --json
forge-studio project show <id> --json
forge-studio project clone <source> <target> --name <name> --version <semver> --patch <file-or-> --json
forge-studio sources list [--status <status>] [--eligibility <tier>] --json
forge-studio releases list [--brand <slug>] --json
forge-studio approved list --json
forge-studio candidate build <project> [--pack essential|digital|social|complete] [--version <semver>] --json
forge-studio release verify <brand> <entry> --json
forge-studio release diff <brand> <base-entry> <target-entry> --json
forge-studio release zip <brand> <entry> --json
forge-studio release acknowledge <brand> <entry> --json
forge-studio portfolio report --json
forge-studio adoption scan <brand> --json
forge-studio adoption discover <absolute-consumer-root> --json
forge-studio adoption plan <absolute-brand-adoption.json> --json
forge-studio agent gate <brand> <entry> --json
forge-studio agent handoff <brand> <entry> --agent <name> --task <issue-id> --json
forge-studio usage list [brand] --json
forge-studio usage register <brand> --consumer <name> --type <type> --location <path-or-url> --json
forge-studio usage link <registration-id> --json
forge-studio drift audit <brand> --json
```

Use `--no-start` when diagnostics must not start the local service. Use `--url` only for a known local Forge Studio service.

## Clone patch fields

Use nested JSON to update creative fields. Common fields are:

```json
{
  "brandName": "Example Brand",
  "tagline": "A clear promise.",
  "seed": "42017",
  "brief": { "category": "...", "cues": "...", "avoid": "...", "direction": "focused" },
  "palette": { "id": "radix-indigo-cyan", "custom": null },
  "identity": {
    "fontId": "field-sans",
    "architecture": "combination",
    "layout": "row-tag",
    "monogram": "EB",
    "monogramStyle": "frame",
    "recipe": { "mark": "bridge", "container": "none", "treatment": "duo", "scale": 0.94 }
  },
  "brandWorld": { "pattern": "offset", "gradient": "signal", "texture": "grain", "imagery": "editorial", "motion": "reveal" },
  "outputPack": "complete",
  "stage": "Promote"
}
```

Do not include `id`, `status`, `revision`, `history`, timestamps, `qa`, `schemaVersion`, `appVersion`, or `publishTskb`. The clone command refuses those fields and never overwrites an existing target project.

## Exit codes

- `0`: success
- `2`: invalid command or arguments
- `3`: service or renderer unavailable
- `4`: CLI/service/renderer version mismatch
- `5`: policy refusal, such as an operator-only action or overwrite attempt
- `6`: validation, rendering, integrity, or API failure

## Release states

- Draft: editable project work only.
- Candidate: immutable, verified review package; not live or known good.
- Approved: operator-reviewed local known good.
- Superseded: retained immutable history, eligible for operator restore.
- X10/TSKB receipt: verified permanent custody; separate from local approval.

## Required evidence

For a successful Candidate build, capture:

- `cliVersion` and `rendererVersion`
- `project.id`, `project.revision`, and `project.assetVersion`
- `release.brand`, `release.entry`, and `release.dir`
- `release.verification.ok` and `release.verification.checked`

For real usage, also capture the Approved release entry, consumer name, durable location, registration ID, and drift-audit result.
