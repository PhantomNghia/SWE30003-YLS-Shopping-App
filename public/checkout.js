// public/checkout.js

// 1) require login on the checkout page
if (!authToken()) {
  window.location.href = '/login.html';
}

// public/checkout.js  (TOP, after auth check)
if (!authToken()) { window.location.href = '/login.html'; }

// ensure profile exists before rendering cart
(async () => {
  const res = await fetch('/api/me/profile', {
    headers: { Authorization: 'Bearer ' + authToken() }
  });
  let profile = null;
  if (res.ok) profile = await res.json();
  const incomplete = !profile || !profile.name || !profile.phone || !profile.line1 || !profile.city || !profile.postcode;

  if (incomplete) {
    // send them to fill details, then come back
    const next = encodeURIComponent('/checkout.html');
    window.location.href = `/account.html?next=${next}`;
    return; // stop loading the cart on this page
  }
})();

// ---- cart helpers (localStorage) ----
function getCart() {
  try { return JSON.parse(localStorage.getItem('cart') || '[]'); }
  catch { return []; }
}
function setCart(items) {
  localStorage.setItem('cart', JSON.stringify(items));
}

// ---- state + render ----
const listEl = document.getElementById('cart-list');
const totalEl = document.getElementById('total');
const checkoutBtn = document.getElementById('checkout');
const selectAllEl = document.getElementById('select-all');

// normalize cart: ensure fields exist {id,name,price,image,variant,qty,selected}
function normalize(items) {
  return items.map(x => ({
    id: x.id,
    name: x.name,
    price: Number(x.price || 0),
    image: x.image || '/placeholder.png',
    variant: x.variant || x.color || x.category || 'Default',
    qty: Number(x.qty || 1),
    selected: x.selected !== false // default true
  }));
}

function money(n){ return '$' + (Number(n||0).toFixed(2)); }

function calc(items){
  let count = 0, sum = 0;
  for (const it of items) if (it.selected) { count += it.qty; sum += it.qty * it.price; }
  return {count, sum};
}

function render(){
  let items = normalize(getCart());
  setCart(items); // persist normalized

  // list
  listEl.innerHTML = items.map(it => `
    <div class="cart-item" data-id="${it.id}">
      <div class="cart-check">
        <input type="checkbox" class="chk" ${it.selected ? 'checked' : ''} />
      </div>
      <img class="cart-img" src="${it.image}" alt="">
      <div class="cart-main">
        <div class="cart-title">${it.name}</div>
        <div class="cart-meta">
          <span class="badge">${it.variant}</span>
          <span class="cart-price">${money(it.price)}</span>
        </div>
      </div>
      <div class="cart-qty">
        <button class="qty-btn minus" aria-label="decrease">−</button>
        <span class="qty">${it.qty}</span>
        <button class="qty-btn plus" aria-label="increase">+</button>
      </div>
    </div>
  `).join('');

  // totals
  const {count, sum} = calc(items);
  totalEl.textContent = money(sum);
  checkoutBtn.textContent = `Checkout (${count})`;
  checkoutBtn.disabled = count === 0;

  // “All” checkbox
  const allChecked = items.length > 0 && items.every(x => x.selected);
  selectAllEl.checked = allChecked;
}

// event: qty +/- and per-item checkbox (event delegation)
listEl.addEventListener('click', (e) => {
  const row = e.target.closest('.cart-item');
  if (!row) return;
  const id = row.dataset.id;
  let items = getCart();
  const ix = items.findIndex(x => String(x.id) === String(id));
  if (ix < 0) return;

  if (e.target.classList.contains('plus')) {
    items[ix].qty = Math.min(999, (items[ix].qty || 1) + 1);
    setCart(items); render(); return;
  }
  if (e.target.classList.contains('minus')) {
    items[ix].qty = Math.max(1, (items[ix].qty || 1) - 1);
    setCart(items); render(); return;
  }
});

listEl.addEventListener('change', (e) => {
  if (!e.target.classList.contains('chk')) return;
  const row = e.target.closest('.cart-item');
  const id = row.dataset.id;
  let items = getCart();
  const ix = items.findIndex(x => String(x.id) === String(id));
  if (ix < 0) return;
  items[ix].selected = !!e.target.checked;
  setCart(items); render();
});

// “All” checkbox toggles
selectAllEl.addEventListener('change', () => {
  let items = getCart();
  const checked = !!selectAllEl.checked;
  items = items.map(x => ({...x, selected: checked}));
  setCart(items); render();
});

// checkout action
checkoutBtn.addEventListener('click', async () => {
  const token = authToken();
  let items = normalize(getCart()).filter(x => x.selected);

  if (items.length === 0) return;

  // call your existing checkout API (adjust if your route differs)
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ cart: items })
  });
  const out = await res.json().catch(() => ({}));

  if (out && out.ok) {
    alert('Purchase completed!');
    // remove only purchased items; keep unselected ones
    const remaining = getCart().filter(x => !items.some(s => String(s.id) === String(x.id)));
    setCart(remaining);
    window.location.href = '/index.html';
  } else {
    alert(out?.error || 'Checkout failed.');
  }
});

// initial render
render();
