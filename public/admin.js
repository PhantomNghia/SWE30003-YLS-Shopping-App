function authUser() { try { return JSON.parse(localStorage.getItem('authUser')); } catch { return null; } }
function authToken() { return localStorage.getItem('authToken'); }

// Gate admin access
const u = authUser();
if (!u || u.role !== 'admin') {
  alert('Admin only. Login as admin@local.com.');
  window.location.href = '/login.html';
}

const form = document.querySelector('#product-form');
const tableBody = document.querySelector('#product-table tbody');
const statusEl = document.querySelector('#status');

// Load products into table
async function loadProducts() {
  const rows = await fetch('/api/admin/products', {
    headers: { Authorization: 'Bearer ' + authToken() }
  }).then(r => r.json());

  tableBody.innerHTML = '';
  for (const p of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>$${p.price.toFixed(2)}</td>
      <td>${p.stock}</td>
      <td><img src="${p.image || ''}" style="width:60px;height:40px;object-fit:cover;border-radius:4px;"></td>
      <td>
        <button data-edit="${p.id}">Edit</button>
        <button data-del="${p.id}" style="color:red;">Delete</button>
      </td>
    `;
    tableBody.appendChild(tr);
  }
}

// Create product
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fd = new FormData(form); // <-- Now FormData to support files

  const res = await fetch('/api/admin/products', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + authToken() },
    body: fd
  }).then(r => r.json());

  if (res.ok) {
    statusEl.textContent = 'Created ✅';
    form.reset();
    loadProducts();
  } else {
    statusEl.textContent = 'Error ❌ ' + (res.error || '');
  }
});


// Edit & Delete actions
tableBody.addEventListener('click', async (e) => {
  const del = e.target.getAttribute('data-del');
  const edit = e.target.getAttribute('data-edit');

  if (del) {
    await fetch(`/api/admin/products/${del}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + authToken() }
    });
    loadProducts();
  }

  if (edit) {
  const row = e.target.closest('tr').children;

  const name = prompt('Name', row[0].innerText);
  if (name === null) return;
  const price = prompt('Price', row[1].innerText.replace('$',''));
  const stock = prompt('Stock', row[2].innerText);
  const image = prompt('Image URL (Leave blank to keep current)', row[3].querySelector('img').src);
  const currentCategory = (row[4]?.dataset?.category) || ''; // if you render it in a hidden cell or data-attr
  const category = prompt('Category (specialty / daily / none)', currentCategory || 'none');

  await fetch(`/api/admin/products/${edit}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + authToken()
    },
    body: JSON.stringify({ name, price, stock, image, category })
  });
    loadProducts();
  }
  
});

loadProducts();
