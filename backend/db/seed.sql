-- Seed data for smoke-testing the Nexus backend.
-- Admin login:  admin@nexus.local  /  admin1234
INSERT INTO "User" (id, email, password_hash, role, data)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@nexus.local',
  'Mxdd/4y1zVXMSE7UeXMpRA==:5UnmBTrRwstDMK3XxMrPjuffebUQL9HwGj6L7U6u/gc=',
  'admin',
  '{"full_name":"Seed Admin","current_balance":0,"total_earnings":0}'::jsonb
) ON CONFLICT (email) DO NOTHING;

-- A sample regular user
INSERT INTO "User" (id, email, password_hash, role, data)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'user@nexus.local',
  'Mxdd/4y1zVXMSE7UeXMpRA==:5UnmBTrRwstDMK3XxMrPjuffebUQL9HwGj6L7U6u/gc=',
  'user',
  '{"full_name":"Seed User","current_balance":5.00,"total_earnings":5.00}'::jsonb
) ON CONFLICT (email) DO NOTHING;

-- Global settings (used by many functions)
INSERT INTO "GlobalSettings" (id, data)
VALUES ('settings-singleton', '{"weekly_jackpot_amount":100,"platform_name":"PlayEarning Nexus"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- A sample A/B test (for abTestAssigner smoke test)
INSERT INTO "SurveyABTest" (id, data)
VALUES ('abtest-seed-1',
  '{"name":"Seed Test","status":"active","traffic_split_a":50,"variant_a":{"label":"A"},"variant_b":{"label":"B"},"variant_a_impressions":0,"variant_b_impressions":0}'::jsonb)
ON CONFLICT (id) DO NOTHING;
