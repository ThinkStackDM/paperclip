#!/usr/bin/env python3
"""Generate idempotent skill-attach UPDATEs for the 2026-06-16 skill pack.
Mirrors attach_skills.sql: append a skill key to agents.adapter_config.paperclipSkillSync.desiredSkills
only if not already present, status<>'terminated'.

Rollout policy (per skill-audit + davin 2026-06-15):
  - RUNBOOK/checklist + platform-research skills -> attached BROADLY to the relevant company/role
    agents on ANY lane (runbooks are safe on strong models too).
  - KNOWLEDGE skills (CRO / A/B / pricing) PASSED the #16 skillbench gate (KEEP on every cheap lane)
    -> scoped to the WEAK/CHEAP lanes only: adapter_type IN ('hermes_local','gemini_local')
    (grok-fast / gemini-flash). Kept OFF the Claude/codex strong primaries (audit: distracts them).
"""
from pathlib import Path

DP   = "e7507bfa-ecfd-4dde-bd2a-7b19947ffdde"
TSMC = "e6361895-a6a4-438d-bb76-b17a0ad026cb"
TSB  = "baba1235-7f5b-4555-aed8-c06efa095125"
TSC  = "211e0f96-ecd2-4fe0-81f8-72059bc6ed46"
TSK  = "6d2c1656-dabd-4aa1-b45a-0f5aedea3092"
TSM  = "d71c9e82-1a4b-497f-9bbc-5b9dd028c367"
TSR  = "cefbbf68-0ca7-4383-967e-03bc1b037ae7"

K = "paperclipai/paperclip/"

# Exclude pure-infra bots (failover compilers + routing PAs + concierge/sentinel) from broad checklists.
NO_INFRA = "(name NOT ILIKE '%compiler%' AND name NOT ILIKE '%routingpa%' AND name NOT IN ('Concierge','Sentinel'))"

# (skill_key, where_clause, comment)
RULES = [
    # ---- RUNBOOKS / CHECKLISTS / PLATFORM-RESEARCH (broad, any lane) ----
    (K + "ship-it-qa-checklist",
     f"status<>'terminated' AND {NO_INFRA}",
     "universal pre-publish gate -> all producing agents (any lane)"),
    (K + "launch-gtm-checklist",
     f"status<>'terminated' AND {NO_INFRA}",
     "launch gate -> all producing agents (any lane)"),
    (K + "seo-keyword-research-no-tools",
     "status<>'terminated' AND role IN ('ceo','cmo','cto','engineer','researcher')",
     "TSK + all: content/SEO/marketing roles across companies"),
    (K + "youtube-packaging-ctr",
     f"status<>'terminated' AND company_id='{TSM}' AND role IN ('ceo','cmo','cto','designer','engineer','general') AND name NOT ILIKE '%compiler%'",
     "TSM video company only"),
    (K + "video-editing",
     f"status<>'terminated' AND company_id='{TSM}' AND role IN ('ceo','cmo','cto','designer','engineer','general') AND name NOT ILIKE '%compiler%'",
     "TSM video company only"),
    (K + "video-assembly-pipeline",
     f"status<>'terminated' AND company_id='{TSM}' AND role IN ('ceo','cmo','cto','designer','engineer','general') AND name NOT ILIKE '%compiler%'",
     "TSM video company only"),
    (K + "auto-captions",
     f"status<>'terminated' AND company_id='{TSM}' AND role IN ('ceo','cmo','cto','designer','engineer','general') AND name NOT ILIKE '%compiler%'",
     "TSM video company only"),
    (K + "kdp-keyword-category-research",
     f"status<>'terminated' AND company_id='{TSB}' AND role IN ('ceo','researcher','general') AND name NOT ILIKE '%compiler%'",
     "TSB books only -> author/editor/architect/research"),
    (K + "etsy-seo-pricing-photography",
     f"status<>'terminated' AND company_id='{DP}' AND role IN ('ceo','designer','researcher','general') AND name NOT ILIKE '%compiler%' AND name NOT ILIKE '%routingpa%' AND name<>'Concierge'",
     "Dastardly Print (Etsy) only"),
    (K + "customer-feedback-loop",
     f"status<>'terminated' AND (role IN ('ceo','cmo','pm') OR (company_id='{TSMC}' AND name='Ledger'))",
     "leadership + analytics (Ledger) across companies"),
    (K + "og-image-rendering",
     f"status<>'terminated' AND company_id IN ('{TSM}','{TSK}','{DP}','{TSB}') AND role IN ('ceo','cmo','cto','designer','engineer','general') AND name NOT ILIKE '%compiler%' AND name NOT ILIKE '%routingpa%' AND name NOT IN ('Concierge','Sentinel')",
     "visual-asset producers in the 4 image-heavy companies (thumbnails/OG/tiles)"),

    # ---- KNOWLEDGE (gate-passed) -> WEAK/CHEAP LANES ONLY (grok-fast / gemini-flash) ----
    (K + "landing-page-cro",
     "status<>'terminated' AND adapter_type IN ('hermes_local','gemini_local') AND role IN ('ceo','cto','cmo','engineer','designer')",
     "page-building roles, cheap lanes only"),
    (K + "ab-testing-discipline",
     "status<>'terminated' AND adapter_type IN ('hermes_local','gemini_local') AND role IN ('ceo','cmo','pm','engineer')",
     "experiment/marketing roles, cheap lanes only"),
    (K + "pricing-strategy",
     "status<>'terminated' AND adapter_type IN ('hermes_local','gemini_local') AND role IN ('ceo','cmo','pm','engineer')",
     "pricing decision roles, cheap lanes only"),
]


def emit(key, where):
    return (
        "UPDATE agents SET adapter_config = jsonb_set(\n"
        "  jsonb_set(COALESCE(adapter_config,'{}'::jsonb), '{paperclipSkillSync}', COALESCE(adapter_config->'paperclipSkillSync','{}'::jsonb), true),\n"
        "  '{paperclipSkillSync,desiredSkills}',\n"
        f"  COALESCE(adapter_config->'paperclipSkillSync'->'desiredSkills','[]'::jsonb) || '[\"{key}\"]'::jsonb, true),\n"
        "  updated_at=now()\n"
        f"WHERE {where}\n"
        f"  AND NOT COALESCE(adapter_config->'paperclipSkillSync'->'desiredSkills','[]'::jsonb) @> '[\"{key}\"]'::jsonb;"
    )


out = ["\\set ON_ERROR_STOP on", "BEGIN;"]
for key, where, comment in RULES:
    out.append(f"\n-- {key.split('/')[-1]}: {comment}")
    out.append(emit(key, where))
out.append("\nCOMMIT;")
Path("/tmp/attach_skillpack.sql").write_text("\n".join(out) + "\n")
print(f"wrote /tmp/attach_skillpack.sql: {len(RULES)} attach rules")
