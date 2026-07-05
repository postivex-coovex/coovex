CREATE TABLE IF NOT EXISTS products (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  type           TEXT        NOT NULL DEFAULT 'service'
                             CHECK (type IN ('product', 'service')),
  tagline        TEXT,
  description    TEXT,
  price          NUMERIC,
  price_unit     TEXT        DEFAULT 'one-time',
  currency       TEXT        DEFAULT 'USD',
  category       TEXT,
  target_audience TEXT,
  key_benefits   TEXT,
  status         TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'draft', 'discontinued')),
  sort_order     INT         NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_business_id_idx ON products(business_id);
CREATE INDEX IF NOT EXISTS products_status_idx      ON products(status);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select" ON products FOR SELECT USING (
  business_id IN (SELECT b.id FROM businesses b JOIN profiles p ON p.current_workspace_id = b.workspace_id WHERE p.id = auth.uid())
);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (
  business_id IN (SELECT b.id FROM businesses b JOIN profiles p ON p.current_workspace_id = b.workspace_id WHERE p.id = auth.uid())
);
CREATE POLICY "products_update" ON products FOR UPDATE USING (
  business_id IN (SELECT b.id FROM businesses b JOIN profiles p ON p.current_workspace_id = b.workspace_id WHERE p.id = auth.uid())
);
CREATE POLICY "products_delete" ON products FOR DELETE USING (
  business_id IN (SELECT b.id FROM businesses b JOIN profiles p ON p.current_workspace_id = b.workspace_id WHERE p.id = auth.uid())
);

-- Add product_id to leads so we can track which product a lead is interested in
ALTER TABLE leads ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS leads_product_id_idx ON leads(product_id);
