-- migrations/008_create_calculator_tables.sql
-- Calculator reference data, ported from the SEMCO Product Calculator
-- Template 2025 v1 (CalculatorBackend tab).
--
-- Two tables:
--   product_yields    — every product/pack-size combo with price, weight,
--                       and per-unit coverage. Multiple rows for products
--                       whose yield depends on the finish (X-Bond Liquid).
--   calculator_configs — per-finish rules (which addons are auto-required).
--
-- Notes on the source data:
--   * SEMCO Liquid Membrane prices in the Vellum/Solid section of the
--     spreadsheet looked like a copy-paste mistake (showed Microbond's
--     prices). We use the prices that appear consistently in the
--     Corsa/Polished and Grain sections: $96.08 / $354.22.
--   * X-Bond Color Activator follows X-Bond Liquid 1:1 in qty terms.
--     We don't store finish-specific yields for it — the calculator
--     just mirrors the Liquid pack count.
--   * Brown coat is intentionally omitted here; that calculator has a
--     different input shape (length × width × thickness) and lands in
--     a follow-up commit.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard > SQL Editor > New query
--   2. Paste this entire file
--   3. Click Run

BEGIN;

CREATE TABLE IF NOT EXISTS calculator_configs (
    finish_type        TEXT PRIMARY KEY,         -- 'corsa', 'polished', 'vellum', 'solid', 'grain'
    finish_group       TEXT NOT NULL,            -- 'corsa_polished', 'vellum_solid', 'grain'
    display_name       TEXT NOT NULL,            -- 'Corsa', 'Polished', etc.
    requires_microbond BOOLEAN NOT NULL DEFAULT false,
    requires_prestain  BOOLEAN NOT NULL DEFAULT false,
    sort_order         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_yields (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_name           TEXT    NOT NULL,    -- 'X-Bond Stone', 'Matte Sealer', etc.
    sku_size               TEXT    NOT NULL,    -- '1 GL', '5 GL', '50 lb Bag', '1 QT Kit', '1.5 GL Kit', '6x75', '29.5x100'
    weight_lbs             NUMERIC,
    price_retail           NUMERIC NOT NULL,
    price_wholesale        NUMERIC,             -- placeholder column; tier pricing lands later
    coverage_sqft_per_unit NUMERIC,             -- NULL when yield depends on user choice (Color Activator, Fabric)
    finish_group           TEXT    NOT NULL,    -- 'corsa_polished'|'vellum_solid'|'grain'|'all'
    product_category       TEXT    NOT NULL,    -- 'stone'|'liquid'|'color_activator'|'microbond'|'prestain'|'slm'|'fabric'|'matte_sealer'|'titan_shield'|'satin_stone'|'natural_shield'
    pack_size              TEXT    NOT NULL DEFAULT 'small'  -- 'small' | 'large' (informs packing optimizer)
                                          CHECK (pack_size IN ('small', 'large')),
    shopify_variant_id     TEXT,                -- placeholder; populated when Phase 3 ships draft orders
    notes                  TEXT,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_name, sku_size, finish_group)
);

CREATE INDEX IF NOT EXISTS idx_product_yields_lookup
    ON product_yields (finish_group, product_category, pack_size);

ALTER TABLE calculator_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_yields     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read" ON calculator_configs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read" ON product_yields
    FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- Seed: calculator_configs (5 finishes across 3 yield groups)
-- ============================================================================

INSERT INTO calculator_configs (finish_type, finish_group, display_name, requires_microbond, requires_prestain, sort_order) VALUES
    ('corsa',    'corsa_polished', 'Corsa',    true,  false, 1),
    ('polished', 'corsa_polished', 'Polished', true,  false, 2),
    ('vellum',   'vellum_solid',   'Vellum',   false, false, 3),
    ('solid',    'vellum_solid',   'Solid',    false, false, 4),
    ('grain',    'grain',          'Grain',    false, true,  5)
ON CONFLICT (finish_type) DO NOTHING;

-- ============================================================================
-- Seed: product_yields
-- ============================================================================
-- X-Bond Stone (same yield across all finishes — single row reused for all groups)
INSERT INTO product_yields (product_name, sku_size, weight_lbs, price_retail, coverage_sqft_per_unit, finish_group, product_category, pack_size) VALUES
    ('X-Bond Stone', '50 lb Bag', 50, 39.85, 70, 'all', 'stone', 'small')
ON CONFLICT (product_name, sku_size, finish_group) DO NOTHING;

-- X-Bond Liquid (yield differs per finish; price stays $45.23/gal)
INSERT INTO product_yields (product_name, sku_size, weight_lbs, price_retail, coverage_sqft_per_unit, finish_group, product_category, pack_size) VALUES
    ('X-Bond Liquid', '1 GL', 10, 45.23,  32, 'corsa_polished', 'liquid', 'small'),
    ('X-Bond Liquid', '5 GL', 46, 226.17, 160, 'corsa_polished', 'liquid', 'large'),
    ('X-Bond Liquid', '1 GL', 10, 45.23,  35, 'vellum_solid',   'liquid', 'small'),
    ('X-Bond Liquid', '5 GL', 46, 226.17, 175, 'vellum_solid',   'liquid', 'large'),
    ('X-Bond Liquid', '1 GL', 10, 45.23,  35, 'grain',          'liquid', 'small'),
    ('X-Bond Liquid', '5 GL', 46, 226.17, 175, 'grain',          'liquid', 'large')
ON CONFLICT (product_name, sku_size, finish_group) DO NOTHING;

-- X-Bond Color Activator (matches Liquid 1:1; coverage left NULL)
INSERT INTO product_yields (product_name, sku_size, weight_lbs, price_retail, coverage_sqft_per_unit, finish_group, product_category, pack_size) VALUES
    ('X-Bond Color Activator', '1 GL', 3, 18.84, NULL, 'all', 'color_activator', 'small'),
    ('X-Bond Color Activator', '5 GL', 3, 94.19, NULL, 'all', 'color_activator', 'large')
ON CONFLICT (product_name, sku_size, finish_group) DO NOTHING;

-- Microbond (Corsa/Polished only)
INSERT INTO product_yields (product_name, sku_size, weight_lbs, price_retail, coverage_sqft_per_unit, finish_group, product_category, pack_size) VALUES
    ('Micro Bond', '1 GL', 5,  51.35,  200, 'corsa_polished', 'microbond', 'small'),
    ('Micro Bond', '5 GL', 30, 205.38, 900, 'corsa_polished', 'microbond', 'large')
ON CONFLICT (product_name, sku_size, finish_group) DO NOTHING;

-- PreStain (Grain only)
INSERT INTO product_yields (product_name, sku_size, weight_lbs, price_retail, coverage_sqft_per_unit, finish_group, product_category, pack_size) VALUES
    ('PreStain', '1 GL', 10, 77.86,  175, 'grain', 'prestain', 'small'),
    ('PreStain', '5 GL', 46, 389.30, 875, 'grain', 'prestain', 'large')
ON CONFLICT (product_name, sku_size, finish_group) DO NOTHING;

-- SEMCO Liquid Membrane (optional addon)
INSERT INTO product_yields (product_name, sku_size, weight_lbs, price_retail, coverage_sqft_per_unit, finish_group, product_category, pack_size) VALUES
    ('SEMCO Liquid Membrane', '1 GL', 10, 96.08,  235,  'all', 'slm', 'small'),
    ('SEMCO Liquid Membrane', '5 GL', 46, 354.22, 1100, 'all', 'slm', 'large')
ON CONFLICT (product_name, sku_size, finish_group) DO NOTHING;

-- Sealers (independent of finish)
INSERT INTO product_yields (product_name, sku_size, weight_lbs, price_retail, coverage_sqft_per_unit, finish_group, product_category, pack_size) VALUES
    ('Matte Sealer',   '1 GL',       10, 121.71, 200,  'all', 'matte_sealer',   'small'),
    ('Matte Sealer',   '5 GL',       46, 608.55, 1000, 'all', 'matte_sealer',   'large'),
    ('Titan Shield',   '1 GL',       10, 105.84, 250,  'all', 'titan_shield',   'small'),
    ('Titan Shield',   '5 GL',       46, 529.19, 1250, 'all', 'titan_shield',   'large'),
    ('Satin Stone',    '1 QT Kit',   5,  106.89, 63,   'all', 'satin_stone',    'small'),
    ('Satin Stone',    '1.5 GL Kit', 5,  279.43, 250,  'all', 'satin_stone',    'large'),
    ('Natural Shield', '1 GL',       10, 97.47,  250,  'all', 'natural_shield', 'small'),
    ('Natural Shield', '5 GL',       46, 487.40, 1250, 'all', 'natural_shield', 'large')
ON CONFLICT (product_name, sku_size, finish_group) DO NOTHING;

-- Fabric Reinforcement (manual qty; coverage NULL because customer picks count)
INSERT INTO product_yields (product_name, sku_size, weight_lbs, price_retail, coverage_sqft_per_unit, finish_group, product_category, pack_size) VALUES
    ('Fabric Reinforcement', '6x75',     1, 57.65,  NULL, 'all', 'fabric', 'small'),
    ('Fabric Reinforcement', '29.5x100', 5, 189.50, NULL, 'all', 'fabric', 'large')
ON CONFLICT (product_name, sku_size, finish_group) DO NOTHING;

COMMIT;

-- Verify after running:
--   SELECT count(*) FROM calculator_configs;   -- expect 5
--   SELECT count(*) FROM product_yields;       -- expect 24
