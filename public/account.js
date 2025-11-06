// require login
if (!authToken()) window.location.href = '/login.html';

const form = document.getElementById('acct-form');
const statusEl = document.getElementById('acct-status');

// pre-fill if exists
(async () => {
  const res = await fetch('/api/me/profile', {
    headers: { Authorization: 'Bearer ' + authToken() }
  });
  if (res.ok) {
    const p = await res.json();
    if (p) {
      form.name.value = p.name || '';
      form.phone.value = p.phone || '';
      form.line1.value = p.line1 || '';
      form.city.value = p.city || '';
      form.postcode.value = p.postcode || '';
    }
  }
})();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.textContent = 'Saving...';

  const body = {
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    line1: form.line1.value.trim(),
    city: form.city.value.trim(),
    postcode: form.postcode.value.trim()
  };

  const res = await fetch('/api/me/profile', {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + authToken(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    statusEl.textContent = 'Saved!';
    // go back to wherever we came from (default: checkout)
    const params = new URLSearchParams(location.search);
    const next = params.get('next') || '/checkout.html';
    location.href = next;
  } else {
    const out = await res.json().catch(()=>({}));
    statusEl.textContent = out.error || 'Failed to save.';
  }
});
