// db.js (ESM)
import Database from 'better-sqlite3';
import path from 'path';
import url from 'url';
import fs from 'fs';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data', 'ecommerce.db');

// safety checks
if (!fs.existsSync(DB_PATH)) {
  throw new Error('Missing data/ecommerce.db. Move your file into /data as ecommerce.db');
}

export const db = new Database(DB_PATH, { verbose: null });

// Optional: ensure minimal schema (no-op if tables already exist)
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  type TEXT,            -- 'specialty'/'daily'
  description TEXT,
  image TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  address_line1 TEXT,
  address_city TEXT,
  address_postcode TEXT,
  total REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  qty INTEGER NOT NULL,
  PRIMARY KEY(order_id, product_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  method TEXT,
  amount REAL NOT NULL,
  paid_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  payer TEXT,
  amount REAL NOT NULL,
  issued_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  courier TEXT,
  tracking TEXT,
  address_line1 TEXT,
  address_city TEXT,
  address_postcode TEXT,
  shipped_at TEXT NOT NULL
);
`);
