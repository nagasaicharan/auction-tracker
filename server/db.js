import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'auction-tracker.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER UNIQUE NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT,
    purchase_price REAL,
    retail_price REAL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','received','inspected','returned','keep','sell_fb','sold_fb')),
    fb_sold_price REAL,
    fb_sold_date TEXT,
    notes TEXT,
    purchase_date TEXT,
    category TEXT,
    condition TEXT,
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
  CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON purchases(product_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT,
    close_time TEXT NOT NULL,
    bid_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','placed','failed','cancelled','missed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    last_result TEXT,
    executed_at TEXT,
    cancelled_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_scheduled_bids_status_close_time
    ON scheduled_bids(status, close_time);
  CREATE INDEX IF NOT EXISTS idx_scheduled_bids_product_id
    ON scheduled_bids(product_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS saved_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    filters TEXT NOT NULL,
    sort_by TEXT NOT NULL DEFAULT 'valueMarginPercent',
    secondary_sort_by TEXT NOT NULL DEFAULT '',
    only_no_damage INTEGER NOT NULL DEFAULT 0,
    only_minor_damage INTEGER NOT NULL DEFAULT 0,
    auto_refresh INTEGER NOT NULL DEFAULT 1,
    poll_seconds INTEGER NOT NULL DEFAULT 30,
    last_run_at TEXT,
    last_result_count INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_saved_searches_updated_at
    ON saved_searches(updated_at);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS lost_relist_cache (
    lost_id TEXT NOT NULL,
    location_name TEXT NOT NULL DEFAULT '',
    lost_item TEXT NOT NULL,
    search TEXT NOT NULL,
    matches TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','checked','error')),
    error TEXT,
    match_count INTEGER NOT NULL DEFAULT 0,
    last_checked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (lost_id, location_name)
  );

  CREATE INDEX IF NOT EXISTS idx_lost_relist_cache_updated_at
    ON lost_relist_cache(updated_at);
  CREATE INDEX IF NOT EXISTS idx_lost_relist_cache_match_count
    ON lost_relist_cache(match_count);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS lost_relist_scan_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    status TEXT NOT NULL DEFAULT 'idle'
      CHECK(status IN ('idle','running','completed','failed')),
    location_name TEXT NOT NULL DEFAULT '',
    started_at TEXT,
    finished_at TEXT,
    total_lost INTEGER NOT NULL DEFAULT 0,
    processed_count INTEGER NOT NULL DEFAULT 0,
    matched_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    search_delay_ms INTEGER NOT NULL DEFAULT 3000,
    lost_page_delay_ms INTEGER NOT NULL DEFAULT 1000,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO lost_relist_scan_state (id) VALUES (1);
`);

// Migrations — add columns if they don't exist
const columns = db.prepare("PRAGMA table_info(purchases)").all().map(c => c.name);

const migrations = [
  ['buy_now_id', 'ALTER TABLE purchases ADD COLUMN buy_now_id INTEGER'],
  ['buyer_premium_pct', 'ALTER TABLE purchases ADD COLUMN buyer_premium_pct REAL DEFAULT 0'],
  ['tax_pct', 'ALTER TABLE purchases ADD COLUMN tax_pct REAL DEFAULT 0'],
  ['buyer_premium', 'ALTER TABLE purchases ADD COLUMN buyer_premium REAL DEFAULT 0'],
  ['tax_amount', 'ALTER TABLE purchases ADD COLUMN tax_amount REAL DEFAULT 0'],
  ['total_cost', 'ALTER TABLE purchases ADD COLUMN total_cost REAL DEFAULT 0'],
  ['return_submitted', 'ALTER TABLE purchases ADD COLUMN return_submitted INTEGER DEFAULT 0'],
];

for (const [col, sql] of migrations) {
  if (!columns.includes(col)) {
    db.exec(sql);
  }
}

export default db;
