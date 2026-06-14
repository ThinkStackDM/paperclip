\set ON_ERROR_STOP on
-- TSMC = e6361895-a6a4-438d-bb76-b17a0ad026cb ; TSB = baba1235-7f5b-4555-aed8-c06efa095125
BEGIN;

-- 1. content-book-craft -> TSB Author + Editor
UPDATE agents SET adapter_config = jsonb_set(
  jsonb_set(COALESCE(adapter_config,'{}'::jsonb), '{paperclipSkillSync}', COALESCE(adapter_config->'paperclipSkillSync','{}'::jsonb), true),
  '{paperclipSkillSync,desiredSkills}',
  COALESCE(adapter_config->'paperclipSkillSync'->'desiredSkills','[]'::jsonb) || '["paperclipai/paperclip/content-book-craft"]'::jsonb, true),
  updated_at=now()
WHERE company_id='baba1235-7f5b-4555-aed8-c06efa095125' AND name IN ('Author','Editor') AND status<>'terminated'
  AND NOT COALESCE(adapter_config->'paperclipSkillSync'->'desiredSkills','[]'::jsonb) @> '["paperclipai/paperclip/content-book-craft"]'::jsonb;

-- 2. escalate-platform-work-to-tsmc -> non-TSMC engineer/cto
UPDATE agents SET adapter_config = jsonb_set(
  jsonb_set(COALESCE(adapter_config,'{}'::jsonb), '{paperclipSkillSync}', COALESCE(adapter_config->'paperclipSkillSync','{}'::jsonb), true),
  '{paperclipSkillSync,desiredSkills}',
  COALESCE(adapter_config->'paperclipSkillSync'->'desiredSkills','[]'::jsonb) || '["paperclipai/paperclip/escalate-platform-work-to-tsmc"]'::jsonb, true),
  updated_at=now()
WHERE company_id<>'e6361895-a6a4-438d-bb76-b17a0ad026cb' AND role IN ('engineer','cto') AND status<>'terminated'
  AND NOT COALESCE(adapter_config->'paperclipSkillSync'->'desiredSkills','[]'::jsonb) @> '["paperclipai/paperclip/escalate-platform-work-to-tsmc"]'::jsonb;

-- 3. make-a-skill -> all cto + ceo (skill creators)
UPDATE agents SET adapter_config = jsonb_set(
  jsonb_set(COALESCE(adapter_config,'{}'::jsonb), '{paperclipSkillSync}', COALESCE(adapter_config->'paperclipSkillSync','{}'::jsonb), true),
  '{paperclipSkillSync,desiredSkills}',
  COALESCE(adapter_config->'paperclipSkillSync'->'desiredSkills','[]'::jsonb) || '["paperclipai/paperclip/make-a-skill"]'::jsonb, true),
  updated_at=now()
WHERE role IN ('cto','ceo') AND status<>'terminated'
  AND NOT COALESCE(adapter_config->'paperclipSkillSync'->'desiredSkills','[]'::jsonb) @> '["paperclipai/paperclip/make-a-skill"]'::jsonb;

-- 4. TRIM Paperclip-platform-dev bundle from non-TSMC engineer/cto (keep create-agent, core paperclip, planning, memory)
UPDATE agents SET adapter_config = jsonb_set(adapter_config, '{paperclipSkillSync,desiredSkills}',
  COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(adapter_config->'paperclipSkillSync'->'desiredSkills') e
            WHERE e #>> '{}' NOT IN ('paperclipai/paperclip/paperclip-dev',
                                     'paperclipai/paperclip/terminal-bench-loop',
                                     'paperclipai/paperclip/paperclip-create-plugin')), '[]'::jsonb)),
  updated_at=now()
WHERE company_id<>'e6361895-a6a4-438d-bb76-b17a0ad026cb' AND role IN ('engineer','cto') AND status<>'terminated'
  AND adapter_config->'paperclipSkillSync'->'desiredSkills' ?| array['paperclipai/paperclip/paperclip-dev',
                                                                     'paperclipai/paperclip/terminal-bench-loop',
                                                                     'paperclipai/paperclip/paperclip-create-plugin'];

COMMIT;
