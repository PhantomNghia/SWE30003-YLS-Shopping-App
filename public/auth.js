const API = {
  async login(email, password) {
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email, password })
    });
    return r.json();
  },
  async register(name, email, password) {
    const r = await fetch('/api/auth/register', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name, email, password })
    });
    return r.json();
  }
};

// Wire login page
const lf = document.querySelector('#login-form');
if (lf) {
  lf.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(lf);
    const res = await API.login(fd.get('email'), fd.get('password'));
    if (!res.ok) return document.querySelector('#login-status').textContent = res.error || 'Login failed';
    localStorage.setItem('authToken', res.token);
    localStorage.setItem('authUser', JSON.stringify(res.user)); // res.user now includes role
    window.location.href = '/';
  });
}

// Wire register page
const rf = document.querySelector('#register-form');
if (rf) {
  rf.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(rf);
    const res = await API.register(fd.get('name'), fd.get('email'), fd.get('password'));
    if (!res.ok) return document.querySelector('#register-status').textContent = res.error || 'Registration failed';
    localStorage.setItem('authToken', res.token);
    localStorage.setItem('authUser', JSON.stringify(res.user));
    window.location.href = '/';
  });
}
