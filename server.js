import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import { db } from './db.js';
// Find by email, ignore soft-deleted rows
const findUserByEmail = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?) AND (is_deleted = 0 OR is_deleted IS NULL)');
import fs from 'fs';
import path from 'path';
import url from 'url';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import Database from 'better-sqlite3'; 

try {
  const cols = db.prepare('PRAGMA table_info(products)').all();
  const hasCategory = cols.some(c => String(c.name).toLowerCase() === 'category');
  
  if (!hasCategory) {
    db.prepare('ALTER TABLE products ADD COLUMN category TEXT').run();
  }

  // Give old products a default value of 'none'
  db.prepare(`
    UPDATE products
       SET category = 'none'
     WHERE category IS NULL
        OR TRIM(category) = ''
  `).run();

  console.log('✅ Category column check/patch completed.');
} catch (e) {
  console.error('⚠️ Category migration failed (continuing anyway):', e);
}

// server.js  (after `import db from './db.js';` and after your other PRAGMA/migrations)
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY,
      name TEXT,
      phone TEXT,
      line1 TEXT,
      city TEXT,
      postcode TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
} catch (e) {
  console.error('user_profiles migration failed:', e);
}

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ dest: path.join(__dirname, 'public', 'uploads') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.redirect('/login.html');
});
// --- In-memory store (persisted minimally via JSON files for demo) ---
const DATA_DIR = path.join(__dirname, 'data');

// Ensure /data exists (failsafe)
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const PRODUCT_FILE = path.join(DATA_DIR, 'products.json');
const ORDER_FILE = path.join(DATA_DIR, 'orders.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function ensureFile(file, fallback) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
}

// Store as "salt:hash" in the single password_hash column
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return { salt, hash, stored: `${salt}:${hash}` };
}

function verifyPassword(password, userRow) {
  // userRow.password_hash is "salt:hash"
  const [salt, storedHash] = String(userRow.password_hash || '').split(':');
  if (!salt || !storedHash) return false;
  const computed = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedHash, 'hex'));
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
function signToken(user) {
  // user: { id, email, name, role }
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role || 'customer' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next();
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch { /* ignore */ }
  next();
}

app.use(authMiddleware);

// GET my profile
app.get('/api/me/profile', requireAuth, (req, res) => {
  const uid = req.user.user_id || req.user.id; // depends on your JWT payload
  const row = db.prepare(`
    SELECT user_id, name, phone, line1, city, postcode
    FROM user_profiles WHERE user_id = ?
  `).get(uid);
  res.json(row || null);
});

// PUT my profile (create or update)
app.put('/api/me/profile', requireAuth, (req, res) => {
  const uid = req.user.user_id || req.user.id;
  const { name, phone, line1, city, postcode } = req.body || {};

  if (!name || !phone || !line1 || !city || !postcode) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }

  const exists = db.prepare(`SELECT 1 FROM user_profiles WHERE user_id = ?`).get(uid);
  if (exists) {
    db.prepare(`
      UPDATE user_profiles
         SET name=@name, phone=@phone, line1=@line1, city=@city, postcode=@postcode, updated_at=CURRENT_TIMESTAMP
       WHERE user_id=@uid
    `).run({ uid, name, phone, line1, city, postcode });
  } else {
    db.prepare(`
      INSERT INTO user_profiles (user_id, name, phone, line1, city, postcode)
      VALUES (@uid, @name, @phone, @line1, @city, @postcode)
    `).run({ uid, name, phone, line1, city, postcode });
  }

  res.json({ ok: true });
});

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN_ADMIN_ONLY' });
  }
  next();
}

// Seed products if needed
let products = readJSON(PRODUCT_FILE, [
  {
    id: 'p1', name: 'Mountain Honey 500g', price: 12.5, stock: 20,
    type: 'specialty', description: 'Raw Victorian honey from alpine flora.',
    image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=800'
  },
  {
    id: 'p2', name: 'Artisan Sourdough', price: 6.9, stock: 15,
    type: 'specialty', description: 'Fresh baked loaf with a crunchy crust.',
    image: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?q=80&w=800'
  },
  {
    id: 'p3', name: 'Toilet Paper (8 pack)', price: 5.8, stock: 50,
    type: 'daily', description: 'Soft, strong and long.',
    image: 'https://images.unsplash.com/photo-1584555613497-9e3dc5c7e169?q=80&w=800'
  },
  {
    id: 'p4', name: 'Jasmine Rice 5kg', price: 13.0, stock: 35,
    type: 'daily', description: 'Fragrant long-grain rice.',
    image: 'https://images.unsplash.com/photo-1602173994037-8e3d4b6fa2a6?q=80&w=800'
  }
]);
writeJSON(PRODUCT_FILE, products);

let orders = readJSON(ORDER_FILE, []);
let stats = readJSON(STATS_FILE, { shippedRevenue: 0, shippedOrders: 0, topProducts: {} });

// --- API reflecting core classes from the design ---

// --- Catalogue / Product listing
app.get('/api/products', (req, res) => {
  const { q, category } = req.query;
  const clauses = ['IFNULL(is_deleted, 0) = 0'];
  const params = {};

  if (q) {
    // ✅ already fixed earlier for SQLite (single quotes inside SQL)
    clauses.push("(name || ' ' || IFNULL(description, '')) LIKE @q");
    params.q = `%${q}%`;
  }

  // --- PROBLEM IS HERE ---
  if (category) {
    if (['specialty', 'daily'].includes(String(category).toLowerCase())) {
      // ❌ BEFORE (causes: no such column: "")
      // clauses.push('LOWER(IFNULL(category, "")) = @cat');

      // ✅ AFTER (SQLite string literal with single quotes)
      clauses.push("LOWER(IFNULL(category, '')) = @cat");

      params.cat = String(category).toLowerCase();
    }
  }

  const where = 'WHERE ' + clauses.join(' AND ');

  const rows = db.prepare(`
    SELECT
      product_id AS id,
      name,
      price,
      stock_quantity AS stock,
      description,
      image_url AS image,
      category
    FROM products
    ${where}
    ORDER BY name
  `).all(params);

  res.json(rows);
});

// Inventory availability check
app.post('/api/validate-cart', (req, res) => {
  const { items } = req.body || { items: [] };
  const getProd = db.prepare('SELECT product_id AS id, stock_quantity AS stock FROM products WHERE product_id = ?');
  const issues = [];
  for (const it of items || []) {
    const p = getProd.get(it.id);
    if (!p) issues.push({ id: it.id, reason: 'NOT_FOUND' });
    else if (it.qty > p.stock) issues.push({ id: it.id, reason: 'INSUFFICIENT_STOCK', stock: p.stock });
  }
  res.json({ ok: issues.length === 0, issues });
});

// Create product (ADMIN ONLY)
app.post('/api/admin/products', requireAdmin, upload.single('imageFile'), (req, res) => {
  const { name, description, price, stock, imageUrl, category } = req.body || {};
  const file = req.file;

  if (!name || !description || price === undefined || stock === undefined) {
    return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS' });
  }

  // NEW: require category
  const cat = String(category || '').toLowerCase();
  if (!['specialty','daily','none'].includes(cat)) {
    return res.status(400).json({ error: 'INVALID_CATEGORY' });
  }

  if (!file && !imageUrl) {
    return res.status(400).json({ error: 'IMAGE_REQUIRED' });
  }

  const storedImage = file ? `/uploads/${file.filename}` : imageUrl;

  db.prepare(`
    INSERT INTO products (name, description, price, stock_quantity, image_url, category, is_deleted, created_at, updated_at)
    VALUES (@name, @description, @price, @stock, @image, @category, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run({
    name,
    description,
    price: Number(price),
    stock: Number(stock),
    image: storedImage,
    category: cat === 'none' ? null : cat
  });

  res.json({ ok: true });
});

// List products (ADMIN ONLY)
app.get('/api/admin/products', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT
      product_id AS id,
      name,
      price,
      stock_quantity AS stock,
      description,
      image_url AS image,
      category
    FROM products
    WHERE IFNULL(is_deleted, 0) = 0
    ORDER BY name
  `).all();
  res.json(rows);
});

// Delete product (ADMIN ONLY) -- soft delete
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  db.prepare(`UPDATE products SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?`)
    .run(req.params.id);
  res.json({ ok: true });
});

// Edit product (ADMIN ONLY)
app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const { name, description, price, stock, image, category } = req.body || {};
  const cat = category === undefined ? undefined : (String(category || '').toLowerCase());

  const setPieces = [
    'name = @name',
    'description = @description',
    'price = @price',
    'stock_quantity = @stock',
    'image_url = @image',
    'updated_at = CURRENT_TIMESTAMP'
  ];
  if (cat !== undefined) setPieces.push('category = @category');

  db.prepare(`
    UPDATE products
       SET ${setPieces.join(', ')}
     WHERE product_id = @id
  `).run({
    id: req.params.id,
    name, description,
    price: Number(price),
    stock: Number(stock),
    image,
    category: cat === 'none' ? null : (['specialty','daily'].includes(cat) ? cat : null)
  });

  const updated = db.prepare(`
    SELECT product_id AS id, name, price, stock_quantity AS stock, description, image_url AS image, category
    FROM products WHERE product_id = ?
  `).get(req.params.id);

  res.json({ ok: true, product: updated });
});

// Order creation (Order + Address + Packaging (simplified) + Shipment (pending))
app.post('/api/orders', (req, res) => {
  const { customer, address, items } = req.body || {};
  if (!items || !items.length) return res.status(400).json({ error: 'EMPTY_CART' });

  const tx = db.transaction(() => {
    const getP = db.prepare('SELECT product_id AS id, name, price, stock_quantity AS stock FROM products WHERE product_id = ?');

    // check & compute total
    let total = 0;
    for (const it of items) {
      const p = getP.get(it.id);
      if (!p) throw new Error(JSON.stringify({ code: 'PRODUCT_NOT_FOUND', id: it.id }));
      if (it.qty > p.stock) throw new Error(JSON.stringify({ code: 'INSUFFICIENT_STOCK', id: it.id, stock: p.stock }));
      total += p.price * it.qty;
    }

    // create order (auto-increment order_id)
    db.prepare(`
      INSERT INTO orders (
        status,
        customer_name, customer_phone,
        address_line1, address_city, address_postcode,
        total, created_at
      )
      VALUES ('SUBMITTED', @name, @phone, @line1, @city, @postcode, @total, CURRENT_TIMESTAMP)
    `).run({
      name: customer?.name || 'Guest',
      phone: customer?.phone || '',
      line1: address?.line1 || '',
      city: address?.city || '',
      postcode: address?.postcode || '',
      total
    });

    const orderId = db.prepare('SELECT last_insert_rowid() AS order_id').get().order_id;

    // items + reserve stock
    const insItem = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, unit_price, quantity, subtotal
      ) VALUES (?,?,?,?,?,?)
    `);
    const decStock = db.prepare(`UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?`);

    for (const it of items) {
      const p = getP.get(it.id);
      const subtotal = p.price * it.qty;
      insItem.run(orderId, p.id, p.name, p.price, it.qty, subtotal);
      decStock.run(it.qty, p.id);
    }

    return orderId;
  });

  try {
    const orderId = tx();
    const order = db.prepare(`SELECT order_id, status, customer_name, customer_phone, address_line1, address_city, address_postcode, total, created_at FROM orders WHERE order_id = ?`).get(orderId);
    const itemsOut = db.prepare(`
      SELECT product_id AS productId, product_name AS name, unit_price AS price, quantity AS qty
      FROM order_items WHERE order_id = ?
    `).all(orderId);

    res.json({ ok: true, order: {
      id: order.order_id,
      status: order.status,
      customer: { name: order.customer_name, phone: order.customer_phone },
      address: { line1: order.address_line1, city: order.address_city, postcode: order.address_postcode },
      total: order.total,
      createdAt: order.created_at,
      items: itemsOut
    }});
  } catch (e) {
    try {
      const err = JSON.parse(e.message);
      return res.status(400).json({ error: err.code, ...err });
    } catch {
      return res.status(500).json({ error: 'ORDER_FAILED' });
    }
  }
});

// Register
app.post('/api/auth/register', (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: 'MISSING_FIELDS' });

  const existing = findUserByEmail.get(email);
  if (existing) return res.status(409).json({ error: 'EMAIL_TAKEN' });

  const { stored } = hashPassword(password);

  // Insert; let SQLite assign user_id (INTEGER PRIMARY KEY)
  db.prepare(`
    INSERT INTO users (email, full_name, password_hash, role, created_at, updated_at, is_deleted)
    VALUES (@email, @full_name, @password_hash, 'customer', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
  `).run({
    email,
    full_name: name,
    password_hash: stored
  });

  const user = findUserByEmail.get(email);
  const token = signToken({ id: user.user_id, email: user.email, name: user.full_name });

  res.json({ ok: true, token, user: { id: user.user_id, email: user.email, name: user.full_name } });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};

  // Hardcoded admin login
  if (String(email).toLowerCase() === 'admin@local.com' && password === '1234') {
    const adminUser = {
      id: 'admin',
      email: 'admin@local.com',
      name: 'Administrator',
      role: 'admin'
    };

    const token = signToken(adminUser);

    return res.json({
      ok: true,
      token,
      user: adminUser
    });
  }

  // Regular user login via DB
  const user = findUserByEmail.get(email);
  if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  if (!verifyPassword(password, user)) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const token = signToken({ id: user.user_id, email: user.email, name: user.full_name });
  res.json({ ok: true, token, user: { id: user.user_id, email: user.email, name: user.full_name } });
});

// Me
app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  res.json({ user: { id: req.user.sub, email: req.user.email, name: req.user.name } });
});

// Payment (Strategy-ready mock) -> on success create TransactionReceipt
app.post('/api/payments', (req, res) => {
  const { orderId, method = 'card' } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
  if (order.status !== 'SUBMITTED') return res.status(400).json({ error: 'INVALID_STATE', status: order.status });

  const paymentId = nanoid(8);
  const receiptId = nanoid(12);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run('PAID', orderId);
    db.prepare('INSERT INTO payments (id, order_id, method, amount, paid_at) VALUES (?,?,?,?,?)')
      .run(paymentId, orderId, method, order.total, now);
    db.prepare('INSERT INTO receipts (id, order_id, payer, amount, issued_at) VALUES (?,?,?,?,?)')
      .run(receiptId, orderId, order.customer_name || 'Guest', order.total, now);
  });

  tx();
  res.json({
    ok: true,
    payment: { id: paymentId, method, amount: order.total, paidAt: now },
    receipt: { id: receiptId, orderId, payer: order.customer_name || 'Guest', amount: order.total, issuedAt: now }
  });
});

// Packaging -> Shipment (simplified transitions)
app.post('/api/orders/:id/pack', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
  if (o.status !== 'PAID') return res.status(400).json({ error: 'INVALID_STATE', status: o.status });
  db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run('PACKED', o.order_id);
  res.json({ ok: true, order: { ...o, status: 'PACKED', id: o.order_id } });
});

app.post('/api/orders/:id/ship', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
  if (o.status !== 'PACKED') return res.status(400).json({ error: 'INVALID_STATE', status: o.status });

  const shipId = nanoid(10);
  const tracking = 'TRACK-' + nanoid(6);
  const ts = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run('SHIPPED', o.order_id);
    db.prepare(`
      INSERT INTO shipments (id, order_id, courier, tracking, address_line1, address_city, address_postcode, shipped_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(
      shipId, o.order_id, 'DemoPost', tracking, o.address_line1, o.address_city, o.address_postcode, ts
    );
  });

  tx();
  const items = db.prepare(`
    SELECT product_id AS productId, product_name AS name, unit_price AS price, quantity AS qty
    FROM order_items WHERE order_id = ?
  `).all(o.order_id);

  res.json({ ok: true, order: { 
    id: o.order_id,
    status: 'SHIPPED',
    shipment: {
      id: shipId, courier: 'DemoPost', tracking,
      address: { line1: o.address_line1, city: o.address_city, postcode: o.address_postcode },
      shippedAt: ts
    },
    items
  }});
});

// Read back receipt / shipment / stats
app.get('/api/receipts/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM receipts WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'RECEIPT_NOT_FOUND' });
  res.json({ id: r.id, orderId: r.order_id, payer: r.payer, amount: r.amount, issuedAt: r.issued_at });
});

app.get('/api/shipments/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'SHIPMENT_NOT_FOUND' });
  res.json({
    id: s.id, courier: s.courier, tracking: s.tracking,
    address: { line1: s.address_line1, city: s.address_city, postcode: s.address_postcode },
    shippedAt: s.shipped_at
  });
});

app.get('/api/stats/sales', (req, res) => {
  const shipped = db.prepare('SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS revenue FROM orders WHERE status = "SHIPPED"').get();
  const top = db.prepare(`
    SELECT oi.product_id AS productId, oi.product_name AS name, SUM(oi.quantity) AS qty
    FROM order_items oi
    JOIN orders o ON o.order_id = oi.order_id
    WHERE o.status = "SHIPPED"
    GROUP BY oi.product_id, oi.product_name
    ORDER BY qty DESC
    LIMIT 5
  `).all();
  res.json({ shippedOrders: shipped.cnt, shippedRevenue: shipped.revenue, topProducts: top });
});


// Serve frontend
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`YLS app listening on http://localhost:${PORT}`);
});
