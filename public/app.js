const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let cart = JSON.parse(localStorage.getItem('cart') || '[]');
const saveCart = () => localStorage.setItem('cart', JSON.stringify(cart));
const renderCartCount = () => $('#cart-count').textContent = cart.reduce((s,i)=>s+i.qty,0);

function authUser() {
  try { return JSON.parse(localStorage.getItem('authUser') || 'null'); }
  catch { return null; }
}
function authToken() {
  return localStorage.getItem('authToken');
}
function renderAuthUI() {
  const user = authUser();
  const chip = document.querySelector('#user-chip');
  const loginLink = document.querySelector('#login-link');
  const logoutBtn = document.querySelector('#logout-btn');
  const adminLink = document.querySelector('#admin-link');
  if (adminLink) {
    const user = authUser();
    adminLink.style.display = user && user.role === 'admin' ? 'inline-block' : 'none';
  }
  if (!chip || !loginLink || !logoutBtn) return;
  if (user && user.role === 'admin') chip.textContent = `Hi, ${user.name} (Admin)`;

  if (user) {
    chip.textContent = `Hi, ${user.name}`;
    chip.style.display = 'inline-block';
    logoutBtn.style.display = 'inline-block';
    loginLink.style.display = 'none';
  } else {
    chip.style.display = 'none';
    logoutBtn.style.display = 'none';
    loginLink.style.display = 'inline';
  }
}

async function fetchProducts(params={}){
  const usp = new URLSearchParams(params);
  const res = await fetch('/api/products?'+usp.toString());
  return await res.json();
}

function productCard(p){
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `
    <img src="${p.image}" alt="${p.name}">
    <div class="info">
      <div class="name">${p.name}</div>
      <div class="desc">${p.description}</div>
      <div class="price">$${p.price.toFixed(2)} • Stock: ${p.stock}</div>
      <div class="add-row">
        <input type="number" min="1" max="${p.stock}" value="1" />
        <button class="add">Add to cart</button>
      </div>
    </div>`;
  const input = div.querySelector('input');
  div.querySelector('.add').onclick = ()=>{
    const qty = Math.max(1, Math.min(Number(input.value||1), p.stock));
    const existing = cart.find(i=>i.id===p.id);
    if (existing) existing.qty += qty; else cart.push({ id:p.id, name:p.name, price:p.price, qty });
    saveCart(); renderCart(); renderCartCount();
  };
  return div;
}

async function renderCatalogue(params={}){
  const list = await fetchProducts(params);
  const container = $('#catalogue');
  container.innerHTML = '';
  list.forEach(p => container.appendChild(productCard(p)));
}

function renderCart(){
  const container = $('#cart-items');
  container.innerHTML = '';
  let total = 0;
  cart.forEach(item=>{
    total += item.price * item.qty;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <div>${item.name}</div>
        <footer>$${item.price.toFixed(2)}</footer>
      </div>
      <div class="qty">
        <button class="dec">-</button>
        <span>${item.qty}</span>
        <button class="inc">+</button>
        <button class="rm">×</button>
      </div>`;
    row.querySelector('.inc').onclick = ()=>{ item.qty++; saveCart(); renderCart(); renderCartCount(); };
    row.querySelector('.dec').onclick = ()=>{ item.qty=Math.max(1,item.qty-1); saveCart(); renderCart(); renderCartCount(); };
    row.querySelector('.rm').onclick = ()=>{ cart = cart.filter(i=>i.id!==item.id); saveCart(); renderCart(); renderCartCount(); };
    container.appendChild(row);
  });
  $('#cart-total').textContent = 'Total: $' + total.toFixed(2);
}

async function checkout(){
  // Require login before checkout
  const user = authUser();
  if (!user) {
    alert("You must create an account or login before making a purchase.");
    window.location.href = "/login.html";
    return;
  }
  if (!cart.length) return alert('Your cart is empty.');

  // Validate stock
  const v = await fetch('/api/validate-cart', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({items: cart}) }).then(r=>r.json());
  if (!v.ok) {
    alert('Some items are unavailable:\n' + v.issues.map(i=>`${i.id}: ${i.reason}${i.stock?` (stock ${i.stock})`:''}`).join('\n'));
    return;
  }

  const dlg = $('#checkout-dialog');
  dlg.showModal();
  $('#checkout-status').textContent = '';

  $('#place-order').onclick = async (e)=>{
    e.preventDefault();
    const fd = new FormData($('#checkout-form'));
    const address = { 
      line1: fd.get('line1'), city: fd.get('city'), postcode: fd.get('postcode'),
      recipient: fd.get('name'), phone: fd.get('phone')
    };
    const customer = { name: fd.get('name'), phone: fd.get('phone') };

    const res = await fetch('/api/orders', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ customer, address, items: cart })
    }).then(r=>r.json());

    if (!res.ok) { $('#checkout-status').textContent = 'Error: ' + (res.error||'ORDER_FAILED'); return; }

    // Pay
    const pay = await fetch('/api/payments', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ orderId: res.order.id, method: 'card' })
    }).then(r=>r.json());

    if (!pay.ok) { $('#checkout-status').textContent = 'Payment failed.'; return; }

    // Pack & Ship
    await fetch(`/api/orders/${res.order.id}/pack`, { method:'POST' });
    const ship = await fetch(`/api/orders/${res.order.id}/ship`, { method:'POST' }).then(r=>r.json());

    cart = []; saveCart(); renderCart(); renderCartCount();
    dlg.close();
    showTracker(res.order.id, pay.receipt.id, ship.order.shipment.id);
  };
}

async function showTracker(orderId, receiptId, shipmentId){
  $('#order-tracker').hidden = false;
  $('#order-status').innerHTML = `<h3>Order</h3><div class="badge">Order ID: ${orderId}</div>`;
  const r = await fetch('/api/receipts/'+receiptId).then(r=>r.json());
  $('#receipt').innerHTML = `<h3>Receipt</h3><div class="badge">#${r.id}</div> <div>Amount: $${r.amount.toFixed(2)}</div><div>Issued: ${new Date(r.issuedAt).toLocaleString()}</div>`;
  const s = await fetch('/api/shipments/'+shipmentId).then(r=>r.json());
  $('#shipment-status').innerHTML = `<h3>Shipment</h3><div class="badge">${s.courier}</div> <div>Tracking: ${s.tracking}</div> <div>Shipped: ${new Date(s.shippedAt).toLocaleString()}</div>`;
  const stats = await fetch('/api/stats/sales').then(r=>r.json());
  $('#stats').innerHTML = `<h3>Sales (Shipped)</h3><div>Orders: ${stats.shippedOrders}</div><div>Revenue: $${stats.shippedRevenue.toFixed(2)}</div><div>Top products: ${stats.topProducts.map(p=>p.name+' x'+p.qty).join(', ')||'—'}</div>`;
}

function wireUI(){
  renderCatalogue();
  renderCart();
  renderCartCount();

  $$('.filter').forEach(btn=>btn.onclick = ()=>{
    renderCatalogue({ category: btn.dataset.cat || '' });
  });
  $('#search').addEventListener('input', (e)=>{
    renderCatalogue({ q: e.target.value });
  });
  $('#checkout').onclick = checkout;
  $('#cart-toggle').onclick = ()=>{
    const el = $('#cart');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  };
    renderAuthUI();
  const logoutBtn = document.querySelector('#logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      renderAuthUI();
    };
  }
}

function currentFilters() {
  const searchEl = document.querySelector('#search');
  const q = (searchEl?.value || '').trim();
  const active = document.querySelector('.filter.active');
  const cat = active?.dataset.cat || ''; // '' means All

  const params = {};
  if (q) params.q = q;
  if (cat) params.category = cat; // only include if not All
  return params;
}

function wireFilters() {
  // Category buttons
  document.querySelectorAll('button.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('button.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCatalogue(currentFilters());
    });
  });

  // Mark "All" as active by default
  const first = document.querySelector('button.filter[data-cat=""]');
  if (first) first.classList.add('active');

  // Search box (Enter + live typing)
  const search = document.querySelector('#search');
  if (search) {
    const run = () => renderCatalogue(currentFilters());
    search.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        run();
      }
    });
    search.addEventListener('input', () => {
      // optional: instant filtering as you type
      run();
    });
  }
}

wireUI();
wireFilters();
