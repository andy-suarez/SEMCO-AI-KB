-- migrations/009_collapse_finish_types.sql
-- Corsa and Polished use identical yields; Vellum and Solid likewise.
-- Drop the 5-row form (corsa, polished, vellum, solid, grain) in
-- calculator_configs and seed 3 grouped rows (corsa_polished,
-- vellum_solid, grain). The finish_type column now uses the same
-- string as finish_group, so the calculator's mapping is identity.
--
-- product_yields is unaffected — it's already keyed on finish_group.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard > SQL Editor > New query
--   2. Paste this entire file
--   3. Click Run

BEGIN;

DELETE FROM calculator_configs;

INSERT INTO calculator_configs (finish_type, finish_group, display_name, requires_microbond, requires_prestain, sort_order) VALUES
    ('corsa_polished', 'corsa_polished', 'Corsa/Polished', true,  false, 1),
    ('vellum_solid',   'vellum_solid',   'Vellum/Solid',   false, false, 2),
    ('grain',          'grain',          'Grain',          false, true,  3);

COMMIT;

-- Verify:
--   SELECT finish_type, display_name FROM calculator_configs ORDER BY sort_order;
--   -- expect: corsa_polished, vellum_solid, grain
