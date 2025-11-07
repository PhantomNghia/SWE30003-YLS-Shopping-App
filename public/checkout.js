
// checkout.standalone.js — one-file, no-backend, force-override checkout
// Works even if app.js already bound its own checkout()
// Strategy:
//  - Neutralize #checkout's existing onclick and bind our own (capturing, stopImmediatePropagation)
//  - Handle #place-order entirely on the client (no server needed)
//  - Render tracker/receipt/stats locally
//  - Keep cart key = 'cart', user key = 'authUser'
//  - Update UI (#cart-items, #cart-total, #cart-count) + emit 'cart:updated'

(function(){
  const $ = (sel)=>document.querySelector(sel);

  function now(){ return new Date(); }
  function aud(n){ try{ return new Intl.NumberFormat(undefined,{style:'currency',currency:'AUD'}).format(+n||0);}catch{return `$${(+n||0).toFixed(2)}`;}}

  function getCart(){
    try{ const arr = JSON.parse(localStorage.getItem('cart')||'[]'); return Array.isArray(arr)?arr.filter(x=>x&&x.qty>0):[]; }catch{return [];}
  }
  function setCart(items){
    localStorage.setItem('cart', JSON.stringify(items||[]));
    window.dispatchEvent(new CustomEvent('cart:updated'));
  }
  function getUser(){
    try{ return JSON.parse(localStorage.getItem('authUser')||'null'); }catch{return null;}
  }
  function totals(items){
    const subtotal = items.reduce((s,it)=>s + (+it.price||0) * (+it.qty||0), 0);
    const shipping = subtotal > 80 ? 0 : (subtotal===0?0:8.95);
    const tax = +(subtotal * 0.10).toFixed(2);
    const total = +(subtotal + shipping + tax).toFixed(2);
    return { subtotal:+subtotal.toFixed(2), shipping, tax, total };
  }

  // --- Begin additions for page-mode & images ---
  async function fetchAllProducts(){
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to load products');
    return res.json();
  }

  // Builds a lookup for images using product id (preferred) or name fallback
  async function buildImageIndex(cart){
    const all = await fetchAllProducts().catch(()=>[]);
    const byId = Object.create(null);
    const byName = Object.create(null);
    for (const p of all) {
      if (p.id) byId[p.id] = p.image || '';
      if (p.name) byName[p.name] = p.image || '';
    }
    // attach image onto cart items without mutating storage shape
    return cart.map(it=>{
      const img = (it.id && byId[it.id]) || (it.name && byName[it.name]) || '';
      return { ...it, image: img };
    });
  }

  function renderCartPreview(items){
    const wrap = document.querySelector('#checkout-items');
    if (!wrap) return;
    wrap.innerHTML = '';

    if (!items.length){
      wrap.innerHTML = `<p>Your cart is empty.</p>`;
      return;
    }

    for (const it of items){
      const div = document.createElement('div');
      div.className = 'checkout-item';
      div.innerHTML = `
        <img class="thumb" src="${it.image || ''}" alt="${it.name || ''}">
        <div class="line">
          <div class="name">${it.name || 'Item'}</div>
          <div class="meta">Qty: ${it.qty} • ${aud(it.price || 0)} each</div>
        </div>
        <div class="line-total">${aud((+it.price||0) * (+it.qty||0))}</div>
      `;
      wrap.appendChild(div);
    }
  }

  function updateTotals(sum){
    const sub = document.querySelector('#subtotal');
    const ship = document.querySelector('#shipping');
    const tax = document.querySelector('#tax');
    const grand = document.querySelector('#grand-total');
    if (sub) sub.textContent = aud(sum.subtotal);
    if (ship) ship.textContent = aud(sum.shipping);
    if (tax) tax.textContent = aud(sum.tax);
    if (grand) grand.textContent = aud(sum.total);
  }
  // --- End additions ---

  // Elements
  const dlg = $('#checkout-dialog');
  const form = $('#checkout-form');
  const btnCheckout = $('#checkout');
  const statusEl = $('#checkout-status');
  const placeBtn = $('#place-order');
  const section = $('#order-tracker');
  const orderStatus = $('#order-status');
  const shipmentStatus = $('#shipment-status');
  const receiptEl = $('#receipt');
  const statsEl = $('#stats');
  // --- Page mode: if there's no dialog, render the cart immediately ---
  const PAGE_MODE = !dlg; // true when we're on /checkout.html
  if (PAGE_MODE) {
    (async ()=>{
      const raw = getCart();
      const itemsWithImages = await buildImageIndex(raw).catch(()=>raw);
      renderCartPreview(itemsWithImages);
      updateTotals(totals(raw));
      prefill();
    })();
  }

  // Harden dialog form so native <form method="dialog"> won't interfere
  if (form) {
    if (form.getAttribute('method') === 'dialog') form.removeAttribute('method');
    const cancelBtn = form.querySelector('button[value="cancel"]');
    if (cancelBtn && cancelBtn.type.toLowerCase() !== 'button') cancelBtn.type = 'button';
    if (placeBtn && placeBtn.type.toLowerCase() !== 'submit') placeBtn.type = 'submit';
  }

  function prefill(){
    const u = getUser();
    if (!u) return;
    const nameEl = form?.querySelector('input[name="name"]');
    if (nameEl && !nameEl.value && u.name) nameEl.value = u.name;
  }

  function openDialog(){
    const items = getCart();
    if (!items.length) { alert('Your cart is empty.'); return; }
    prefill();
    if (dlg && dlg.showModal) dlg.showModal();
  }

  // Neutralize app.js property handler and bind our own robustly
  if (btnCheckout){
    try { btnCheckout.onclick = null; } catch {}
    btnCheckout.addEventListener('click', (e)=>{ e.preventDefault(); e.stopImmediatePropagation(); openDialog(); }, { capture:true });
  }

  // Ensure Cancel just closes
  if (form){
    const cancelBtn = form.querySelector('button[value="cancel"]');
    cancelBtn?.addEventListener('click', (e)=>{ e.preventDefault(); dlg?.close?.(); });
  }

  // Render tracker/receipt/stats
  function renderTracker(model){
    section.hidden = false;
    const { orderId, stages, items, sum } = model;

    orderStatus.innerHTML = `
      <h3>Order #${orderId}</h3>
      <ol>
        ${stages.map(s=>`<li><strong>${s.label}</strong> — ${new Date(s.at).toLocaleString()}</li>`).join('')}
      </ol>
    `;
    shipmentStatus.innerHTML = `
      <h4>Shipment</h4>
      <p>Carrier: AusPost • Tracking: <code>${orderId.replace('YLS-','AP')}</code></p>
    `;
    receiptEl.innerHTML = `
      <h4>Receipt</h4>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Price</th><th align="right">Line</th></tr>
        </thead>
        <tbody>
          ${items.map(it=>`
            <tr>
              <td>${it.name}</td><td align="right">${it.qty}</td>
              <td align="right">${aud(it.price)}</td>
              <td align="right">${aud((+it.price||0)*(+it.qty||0))}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="3" align="right">Subtotal</td><td align="right">${aud(sum.subtotal)}</td></tr>
          <tr><td colspan="3" align="right">Shipping</td><td align="right">${aud(sum.shipping)}</td></tr>
          <tr><td colspan="3" align="right">Tax (10% GST)</td><td align="right">${aud(sum.tax)}</td></tr>
          <tr><td colspan="3" align="right"><strong>Total</strong></td><td align="right"><strong>${aud(sum.total)}</strong></td></tr>
        </tfoot>
      </table>
    `;
    const units = items.reduce((s,it)=>s + (+it.qty||0), 0);
    statsEl.innerHTML = `<h4>Stats</h4><p>Units: <strong>${units}</strong></p><p>Order total: <strong>${aud(sum.total)}</strong></p>`;
  }

  function makeOrder(items, sum){
    const id = 'YLS-' + Math.random().toString(36).slice(2,10).toUpperCase();
    const t0 = now().getTime();
    const mk = (h)=>new Date(t0 + h*3600*1000);
    const etaDays = 2 + Math.ceil(Math.random()*4);
    const stages = [
      { key:'received',  label:'Order Received',  at: mk(0)  },
      { key:'packed',    label:'Packed',         at: mk(12) },
      { key:'shipped',   label:'Shipped',        at: mk(24) },
      { key:'in_transit',label:'In Transit',     at: mk(48) },
      { key:'delivered', label:'Delivered (ETA)',at: new Date(t0 + etaDays*24*3600*1000) },
    ];
    return { orderId:id, stages, items, sum };
  }

  // Handle Place Order (no backend)
  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    statusEl.textContent = '';
    if (!getCart().length){ statusEl.textContent = 'Cart is empty.'; return; }

    // collect items & totals
    const items = getCart();
    const sum = totals(items);

    // (Optional) validate form fields
    const fd = new FormData(form);
    const required = ['name','phone','line1','city','postcode'];
    for (const k of required){
      const v = (fd.get(k)||'').toString().trim();
      if (!v){ statusEl.textContent = `Please complete: ${k}`; return; }
    }

    // fake "processing"
    if (placeBtn){ placeBtn.disabled = true; placeBtn.textContent = 'Placing Order...'; }
    await new Promise(r=>setTimeout(r, 500));

    // build local order and render
    const model = makeOrder(items, sum);
    dlg?.close?.();
    renderTracker(model);

    // clear cart + UI
    setCart([]);
    const cartItems = $('#cart-items');
    const cartTotal = $('#cart-total');
    const cartCount = $('#cart-count');
    if (cartItems) cartItems.innerHTML = '';
    if (cartTotal) cartTotal.textContent = '';
    if (cartCount) cartCount.textContent = '0';
    // If we're on the dedicated checkout page, clear the preview/totals too
    if (PAGE_MODE) {
      renderCartPreview([]);
      updateTotals({ subtotal:0, shipping:0, tax:0, total:0 });
    }

    if (placeBtn){ placeBtn.disabled = false; placeBtn.textContent = 'Place Order'; }
  });

  // ESC or native cancel
  dlg?.addEventListener('cancel', (e)=>{ e.preventDefault(); dlg.close(); });
})();
