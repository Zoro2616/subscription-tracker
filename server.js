const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-this';
const DATA_FILE = path.join(__dirname, 'data', 'data.json');

// Ensure data folder and file exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], subscriptions: [] }, null, 2));
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Register
app.post('/api/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const data = readData();
  if (data.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already exists' });
  }

  const user = {
    id: uuidv4(),
    email,
    password_hash: bcrypt.hashSync(password, 10),
    created_at: new Date().toISOString()
  };
  data.users.push(user);
  writeData(data);

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, email: user.email });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const data = readData();
  const user = data.users.find(u => u.email === email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, email: user.email });
});

// Get all subscriptions
app.get('/api/subscriptions', auth, (req, res) => {
  const data = readData();
  const subs = data.subscriptions
    .filter(s => s.user_id === req.user.id)
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
  res.json(subs);
});

// Add subscription
app.post('/api/subscriptions', auth, (req, res) => {
  const { name, amount, billing_cycle, next_due_date, category, notes } = req.body;
  const data = readData();

  const sub = {
    id: uuidv4(),
    user_id: req.user.id,
    name,
    amount: parseFloat(amount),
    currency: 'INR',
    billing_cycle,
    next_due_date,
    category: category || 'other',
    notes: notes || '',
    created_at: new Date().toISOString()
  };

  data.subscriptions.push(sub);
  writeData(data);
  res.json({ id: sub.id });
});

// Delete subscription
app.delete('/api/subscriptions/:id', auth, (req, res) => {
  const data = readData();
  data.subscriptions = data.subscriptions.filter(
    s => !(s.id === req.params.id && s.user_id === req.user.id)
  );
  writeData(data);
  res.json({ success: true });
});

// Dashboard stats
app.get('/api/stats', auth, (req, res) => {
  const data = readData();
  const subs = data.subscriptions.filter(s => s.user_id === req.user.id);

  let monthly = 0, yearly = 0;
  subs.forEach(s => {
    if (s.billing_cycle === 'monthly') {
      monthly += s.amount;
      yearly += s.amount * 12;
    } else {
      yearly += s.amount;
      monthly += s.amount / 12;
    }
  });

  const today = new Date().toISOString().slice(0, 10);
  const next7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const upcoming = subs.filter(s => s.next_due_date >= today && s.next_due_date <= next7);

  res.json({
    monthly: monthly.toFixed(2),
    yearly: yearly.toFixed(2),
    upcoming,
    total: subs.length
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
