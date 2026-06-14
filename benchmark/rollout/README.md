# Fleet rollout tooling (2026-06-14)

Operational scripts used for the model/skill rollout. See ../MEDIA-AND-FAILOVER.md Part F.

- `gen_skill_sql.py` — generate per-company `company_skills` upserts for new bundled skills.
- `attach_skills.sql` — attach new skills to target agents + trim the Paperclip-dev bundle from non-TSMC.
- `create_sister.py` — create ONE cross-pool sister (clones a primary's AGENTS.md + skills; dormant wake-on-demand).
- `create_sisters_batch.py` — batch-create worker sisters with model+skill parity (idempotent).

Skill attach/remove use jsonb on `agents.adapter_config.paperclipSkillSync.desiredSkills`
(remove compares `e #>> '{}'`). New agents auto-expand desiredSkills to all bundled skills,
so set parity explicitly after creation. Sisters use `heartbeat:{enabled:false,wakeOnDemand:true}`
= no idle load, available for work + failover. Creation needs the user-authorized
`dangerouslyBypassApprovalsAndSandbox` flag (fleet standard for local_trusted).
