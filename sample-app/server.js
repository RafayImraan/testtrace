/**
 * Sample App - System Under Test (SUT) for the automation module.
 * A tiny e-commerce app with intentional bugs to demo failure handling.
 *
 * Pages:
 *  /              - landing
 *  /login         - login form (hardcoded users)
 *  /products      - catalog with search
 *  /cart          - cart page
 *  /checkout      - checkout form
 *
 * APIs:
 *  POST /api/login
 *  GET  /api/products?q=
 *  POST /api/cart
 *  POST /api/checkout
 *  GET  /api/health
 *
 * Bugs (when BUG_MODE=true):
 *  - /api/products returns 500 randomly for q=empty (to make search-empty fail)
 *  - /api/checkout returns 500 for coupon=FAIL (intentional failure)
 *  - /login page has a hidden race condition: button disabled for 500ms after click
 *  - /api/cart total calculation is off by 1 when qty>3 (intentional logic bug)
 */

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT || process.env.SAMPLE_APP_PORT || 5000);
const BUG_MODE = String(process.env.BUG_MODE || 'true') === 'true';

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data
const USERS = [
  { id: 1, email: 'user@shop.local', password: 'User@123', name: 'Demo User' },
  { id: 2, email: 'admin@shop.local', password: 'Admin@123', name: 'Shop Admin' },
];

const PRODUCTS = [
  { id: 1, name: 'Wireless Mouse', price: 25.99, category: 'Electronics', stock: 100 },
  { id: 2, name: 'Mechanical Keyboard', price: 89.99, category: 'Electronics', stock: 50 },
  { id: 3, name: 'USB-C Hub', price: 35.5, category: 'Electronics', stock: 75 },
  { id: 4, name: 'Laptop Stand', price: 45.0, category: 'Accessories', stock: 30 },
  { id: 5, name: 'Noise Cancelling Headphones', price: 199.99, category: 'Electronics', stock: 20 },
  { id: 6, name: 'Smart Watch', price: 149.99, category: 'Electronics', stock: 15 },
  { id: 7, name: 'Water Bottle', price: 15.0, category: 'Lifestyle', stock: 200 },
  { id: 8, name: 'Backpack', price: 55.0, category: 'Lifestyle', stock: 60 },
];

// --- API ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'sample-app', bugMode: BUG_MODE, time: new Date().toISOString() }));

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = USERS.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // intentional bug: if BUG_MODE and email contains "admin", sometimes return 500
  if (BUG_MODE && email.includes('admin') && Math.random() < 0.15) {
    return res.status(500).json({ error: 'Internal server error (intentional bug)' });
  }
  res.json({ token: `fake-jwt-${user.id}-${Date.now()}`, user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/api/products', (req, res) => {
  const q = (req.query.q || '').toString().trim().toLowerCase();
  // intentional bug: empty search returns 500 half the time when BUG_MODE
  if (BUG_MODE && q === '' && Math.random() < 0.3) {
    return res.status(500).json({ error: 'Failed to fetch products (intentional bug for empty query)' });
  }
  let list = PRODUCTS;
  if (q) list = PRODUCTS.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  res.json({ data: list, total: list.length });
});

app.post('/api/cart', (req, res) => {
  const { productId, qty = 1 } = req.body || {};
  const product = PRODUCTS.find((p) => p.id === Number(productId));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  let total = product.price * Number(qty);
  // intentional bug: total off by 1 when qty > 3
  if (BUG_MODE && Number(qty) > 3) total += 1;
  res.json({ productId: product.id, qty: Number(qty), unitPrice: product.price, total, bugMode: BUG_MODE });
});

app.post('/api/checkout', (req, res) => {
  const { items, coupon, address } = req.body || {};
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  if (!address) return res.status(400).json({ error: 'Address required' });
  if (coupon === 'FAIL' || (BUG_MODE && coupon === 'BUG')) {
    return res.status(500).json({ error: 'Checkout failed due to payment gateway error (intentional bug)' });
  }
  if (coupon && coupon !== 'SAVE10') {
    return res.status(400).json({ error: 'Invalid coupon' });
  }
  const orderId = `ORD-${Date.now()}`;
  res.json({ orderId, status: 'confirmed', emailSent: true, items, total: items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0) });
});

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🛍️  Sample App (SUT) listening on http://localhost:${PORT}  bugMode=${BUG_MODE}`);
  console.log(`    Health: http://localhost:${PORT}/api/health\n`);
});
