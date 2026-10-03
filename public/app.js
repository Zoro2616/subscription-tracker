const API = '';
let token = localStorage.getItem('token');
let isLogin = true;

function toggleAuth() {
  isLogin = !isLogin;
  document.getElementById('auth-title').textContent = isLogin ? 'Login' : 'Register';
  document.querySelector('.toggle').textContent = isLogin
    ? "Don't have an account? Register"
    : 'Already have an account? Login';
  document.getElementById('auth-error').textContent = '';
}

async function handleAuth() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const endpoint = isLogin ? '/api/login' : '/api/register';
  try {
    const res = await fetch(API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    token = data.token;
    localStorage.setItem('token', token);
    localStorage.setItem('email', data.email);
    showApp();
  } catch (e) {
    document.getElementById('auth-error').textContent = e.message;
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('email');
  token = null;
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('app-section').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('app-section').classList.remove('hidden');
  document.getElementById('user-email').textContent = localStorage.getItem('email');
  loadStats();
  loadSubscriptions();
}

async function loadStats() {
  const res = await fetch(API + '/api/stats', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const data = await res.json();
  document.getElementById('monthly').textContent = '₹' + data.monthly;
  document.getElementById('yearly').textContent = '₹' + data.yearly;
  document.getElementById('total').textContent = data.total;

  const list = document.getElementById('upcoming-list');
  if (data.upcoming.length === 0) {
    list.innerHTML = '<p style="color:#666">No upcoming renewals</p>';
  } else {
    list.innerHTML = data.upcoming.map(s => `
      <div class="sub-item">
        <div class="sub-info">
          <h4>${s.name}</h4>
          <span>Due: ${s.next_due_date}</span>
        </div>
        <div class="sub-amount">₹${s.amount}</div>
      </div>
    `).join('');
  }
}

async function loadSubscriptions() {
  const res = await fetch(API + '/api/subscriptions', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const subs = await res.json();
  const list = document.getElementById('subs-list');
  if (subs.length === 0) {
    list.innerHTML = '<p style="color:#666">No subscriptions yet</p>';
    return;
  }
  list.innerHTML = subs.map(s => `
    <div class="sub-item">
      <div class="sub-info">
        <h4>${s.name}</h4>
        <span>${s.category} • ${s.billing_cycle} • Next: ${s.next_due_date}</span>
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        <div class="sub-amount">₹${s.amount}</div>
        <button class="delete-btn" onclick="deleteSub('${s.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

async function addSubscription() {
  const body = {
    name: document.getElementById('name').value,
    amount: parseFloat(document.getElementById('amount').value),
    billing_cycle: document.getElementById('cycle').value,
    next_due_date: document.getElementById('due-date').value,
    category: document.getElementById('category').value
  };
  if (!body.name || !body.amount || !body.next_due_date) return alert('Fill all fields');

  await fetch(API + '/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body)
  });

  document.getElementById('name').value = '';
  document.getElementById('amount').value = '';
  document.getElementById('due-date').value = '';
  loadStats();
  loadSubscriptions();
}

async function deleteSub(id) {
  if (!confirm('Delete this subscription?')) return;
  await fetch(API + '/api/subscriptions/' + id, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  });
  loadStats();
  loadSubscriptions();
}

if (token) showApp();
