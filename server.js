import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import url from 'url';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';


const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- In-memory store (persisted minimally via JSON files for demo) ---
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

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

ensureFile(USERS_FILE, []);
let users = readJSON(USERS_FILE, []); // [{id,email,name,passwordHash,salt,createdAt}]

function saveUsers() { writeJSON(USERS_FILE, users); }

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return { salt, hash };
}
function verifyPassword(password, user) {
  const vh = crypto.pbkdf2Sync(password, user.salt, 120000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(vh, 'hex'), Buffer.from(user.passwordHash, 'hex'));
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
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

// Catalogue / Product listing
app.get('/api/products', (req, res) => {
  const { category, q } = req.query;
  let list = [...products];
  if (category) list = list.filter(p => p.type === category);
  if (q) list = list.filter(p => (p.name + ' ' + p.description).toLowerCase().includes(q.toLowerCase()));
  res.json(list);
});

// Inventory availability check
app.post('/api/validate-cart', (req, res) => {
  const { items } = req.body; // [{id, qty}]
  const issues = [];
  for (const it of items || []) {
    const p = products.find(p => p.id === it.id);
    if (!p) issues.push({ id: it.id, reason: 'NOT_FOUND' });
    else if (it.qty > p.stock) issues.push({ id: it.id, reason: 'INSUFFICIENT_STOCK', stock: p.stock });
  }
  res.json({ ok: issues.length === 0, issues });
});

// Order creation (Order + Address + Packaging (simplified) + Shipment (pending))
app.post('/api/orders', (req, res) => {
  const { customer, address, items } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'EMPTY_CART' });

  // check stock
  for (const it of items) {
    const p = products.find(p => p.id === it.id);
    if (!p) return res.status(400).json({ error: 'PRODUCT_NOT_FOUND', id: it.id });
    if (it.qty > p.stock) return res.status(400).json({ error: 'INSUFFICIENT_STOCK', id: it.id, stock: p.stock });
  }

  const orderId = nanoid(10);
  const total = items.reduce((sum, it) => {
    const p = products.find(p => p.id === it.id);
    return sum + p.price * it.qty;
  }, 0);

  const order = {
    id: orderId,
    status: 'SUBMITTED', // SUBMITTED -> PAID -> PACKED -> SHIPPED -> CANCELLED
    customer: customer || { name: 'Guest' },
    address,
    items: items.map(it => ({
      productId: it.id,
      name: products.find(p => p.id === it.id)?.name || '',
      price: products.find(p => p.id === it.id)?.price || 0,
      qty: it.qty
    })),
    total,
    createdAt: new Date().toISOString()
  };

  // reserve inventory
  for (const it of items) {
    const p = products.find(p => p.id === it.id);
    p.stock -= it.qty;
  }
  writeJSON(PRODUCT_FILE, products);

  orders.push(order);
  writeJSON(ORDER_FILE, orders);

  res.json({ ok: true, order });
});

// Register
app.post('/api/auth/register', (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: 'MISSING_FIELDS' });
  const exists = users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: 'EMAIL_TAKEN' });

  const id = nanoid(10);
  const { salt, hash } = hashPassword(password);
  const user = { id, email, name, passwordHash: hash, salt, createdAt: new Date().toISOString() };
  users.push(user); saveUsers();

  const token = signToken(user);
  res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name } });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  if (!verifyPassword(password, user)) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const token = signToken(user);
  res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name } });
});

// Me
app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  res.json({ user: { id: req.user.sub, email: req.user.email, name: req.user.name } });
});

// Payment (Strategy-ready mock) -> on success create TransactionReceipt
app.post('/api/payments', (req, res) => {
  const { orderId, method = 'card' } = req.body;
  const order = orders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
  if (order.status !== 'SUBMITTED') return res.status(400).json({ error: 'INVALID_STATE', status: order.status });

  // Mock gateway
  const paymentId = nanoid(8);
  order.status = 'PAID';
  order.payment = { id: paymentId, method, amount: order.total, paidAt: new Date().toISOString() };

  // Create Transaction Receipt
  const receiptId = nanoid(12);
  order.receipt = {
    id: receiptId,
    orderId: order.id,
    payer: order.customer?.name || 'Guest',
    amount: order.total,
    issuedAt: new Date().toISOString()
  };

  writeJSON(ORDER_FILE, orders);
  res.json({ ok: true, payment: order.payment, receipt: order.receipt });
});

// Packaging -> Shipment (simplified transitions)
app.post('/api/orders/:id/pack', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
  if (order.status !== 'PAID') return res.status(400).json({ error: 'INVALID_STATE', status: order.status });

  order.status = 'PACKED';
  order.packaging = { type: 'STANDARD', packedAt: new Date().toISOString() };
  writeJSON(ORDER_FILE, orders);
  res.json({ ok: true, order });
});

app.post('/api/orders/:id/ship', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
  if (order.status !== 'PACKED') return res.status(400).json({ error: 'INVALID_STATE', status: order.status });

  order.status = 'SHIPPED';
  order.shipment = {
    id: nanoid(10),
    courier: 'DemoPost',
    tracking: 'TRACK-' + nanoid(6),
    address: order.address,
    shippedAt: new Date().toISOString()
  };

  // Update Sales Statistics (only shipped count as sales per design)
  stats.shippedRevenue += order.total;
  stats.shippedOrders += 1;
  for (const it of order.items) {
    stats.topProducts[it.productId] = (stats.topProducts[it.productId] || 0) + it.qty;
  }
  writeJSON(STATS_FILE, stats);
  writeJSON(ORDER_FILE, orders);
  res.json({ ok: true, order });
});

// Read back receipt / shipment / stats
app.get('/api/receipts/:id', (req, res) => {
  const order = orders.find(o => o.receipt?.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'RECEIPT_NOT_FOUND' });
  res.json(order.receipt);
});

app.get('/api/shipments/:id', (req, res) => {
  const order = orders.find(o => o.shipment?.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'SHIPMENT_NOT_FOUND' });
  res.json(order.shipment);
});

app.get('/api/stats/sales', (req, res) => {
  // compute top 5 products
  const top = Object.entries(stats.topProducts)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5)
    .map(([pid, qty]) => {
      const p = products.find(p=>p.id===pid);
      return { productId: pid, name: p?.name || pid, qty };
    });
  res.json({
    shippedOrders: stats.shippedOrders,
    shippedRevenue: stats.shippedRevenue,
    topProducts: top
  });
});

// Serve frontend
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`YLS app listening on http://localhost:${PORT}`);
});
