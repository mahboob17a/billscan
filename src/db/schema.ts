/**
 * On-phone database (SQLite). Every row carries user_id, so two supervisors
 * sharing a phone never see each other's bills. Amounts are integer baisa.
 * Migrations run in order; PRAGMA user_version records the applied count.
 */

export const SECTIONS = ['MATERIAL', 'SEWAGE', 'TOOLS', 'FUEL'] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_INFO: Record<Section, { letter: string; title: string }> = {
  MATERIAL: { letter: 'A', title: 'Material Purchases' },
  SEWAGE: { letter: 'C', title: 'Sewage Removal' },
  TOOLS: { letter: 'D', title: 'Tools' },
  FUEL: { letter: 'E', title: 'Fuel' },
};

export const DEFAULT_DESCRIPTIONS: { label: string; section: Section }[] = [
  { label: 'MEP Purchase', section: 'MATERIAL' },
  { label: 'Plumbing Material', section: 'MATERIAL' },
  { label: 'Electrical Goods', section: 'MATERIAL' },
  { label: 'HVAC Spares', section: 'MATERIAL' },
  { label: 'Carpentry Item', section: 'MATERIAL' },
  { label: 'Paint', section: 'MATERIAL' },
  { label: 'Tiles', section: 'MATERIAL' },
  { label: 'Civil Material', section: 'MATERIAL' },
  { label: 'Consumables', section: 'MATERIAL' },
  { label: 'Sewage Removal', section: 'SEWAGE' },
  { label: 'Septic Tank Cleaning', section: 'SEWAGE' },
  { label: 'Drain Jetting', section: 'SEWAGE' },
  { label: 'Hand Tools', section: 'TOOLS' },
  { label: 'Power Tools', section: 'TOOLS' },
  { label: 'Tool Accessories', section: 'TOOLS' },
  { label: 'Safety Equipment', section: 'TOOLS' },
  { label: 'Vehicle Fuel', section: 'FUEL' },
  { label: 'Generator Diesel', section: 'FUEL' },
];

export const MIGRATIONS: string[] = [
  // 1 — initial schema
  `
  CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT NOT NULL,
    key     TEXT NOT NULL,
    value   TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );

  CREATE TABLE IF NOT EXISTS report_month (
    user_id        TEXT NOT NULL,
    month          TEXT NOT NULL,              -- YYYY-MM
    statement_ref  TEXT NOT NULL,
    date_prepared  TEXT,                       -- YYYY-MM-DD
    status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','exported')),
    exported_at    TEXT,
    PRIMARY KEY (user_id, month)
  );

  CREATE TABLE IF NOT EXISTS bill (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    month           TEXT NOT NULL,
    section         TEXT NOT NULL CHECK (section IN ('MATERIAL','SEWAGE','TOOLS','FUEL')),
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','saved','cancelled')),
    bill_date       TEXT,
    bill_no         TEXT,
    no_bill_no      INTEGER NOT NULL DEFAULT 0,
    vendor_name     TEXT,
    vendor_vat_no   TEXT,
    description     TEXT NOT NULL DEFAULT '',
    shop_rate       INTEGER,                   -- baisa, before any discount
    vat             INTEGER,
    discount        INTEGER NOT NULL DEFAULT 0,
    discount_type   TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('before_vat','after_vat','none')),
    grand_total     INTEGER,
    total_only      INTEGER NOT NULL DEFAULT 0,
    payment_mode    TEXT,
    remarks         TEXT NOT NULL DEFAULT '',
    flags           TEXT NOT NULL DEFAULT '[]', -- JSON array of check codes
    image_paths     TEXT NOT NULL DEFAULT '[]', -- JSON array of local file URIs
    ai_raw_json     TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS bill_user_month ON bill (user_id, month, section);
  CREATE INDEX IF NOT EXISTS bill_dupe ON bill (user_id, bill_no);

  CREATE TABLE IF NOT EXISTS cash_entry (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    month       TEXT NOT NULL,
    entry_date  TEXT NOT NULL,
    description TEXT NOT NULL,
    amount      INTEGER NOT NULL,
    remarks     TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS cash_user_month ON cash_entry (user_id, month);

  CREATE TABLE IF NOT EXISTS description_catalog (
    user_id  TEXT NOT NULL,
    label    TEXT NOT NULL,
    section  TEXT NOT NULL CHECK (section IN ('MATERIAL','SEWAGE','TOOLS','FUEL')),
    active   INTEGER NOT NULL DEFAULT 1,
    sort     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, label)
  );
  `,
];
