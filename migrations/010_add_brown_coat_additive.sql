-- migrations/010_add_brown_coat_additive.sql
-- Adds X-Bond Additive (the third ingredient in the brown coat mixture).
-- Stone and Liquid are reused from existing rows.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard > SQL Editor > New query
--   2. Paste this entire file
--   3. Click Run

BEGIN;

INSERT INTO product_yields (product_name, sku_size, weight_lbs, price_retail, coverage_sqft_per_unit, finish_group, product_category, pack_size) VALUES
    ('X-Bond Additive', '20 lb Bag', 20, 48.05, NULL, 'brown_coat', 'brown_coat_additive', 'small')
ON CONFLICT (product_name, sku_size, finish_group) DO NOTHING;

COMMIT;
