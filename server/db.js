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
