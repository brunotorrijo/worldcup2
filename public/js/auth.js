document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('#auth-tabs .tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
      } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
      }
    });
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) return showToast('Please fill in all fields', 'error');

    try {
      const data = await API.post('/api/auth/login', { username, password });
      if (data.league) {
        setPlayerInfo(data.league.id, data.playerId, data.username, true);
      } else {
        localStorage.setItem('isCreator', 'true');
      }
      showToast('Welcome back!');
      setTimeout(() => window.location.href = '/dashboard.html', 500);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (!username || !password || !confirm) return showToast('Please fill in all fields', 'error');
    if (password !== confirm) return showToast('Passwords do not match', 'error');
    if (username.length < 3) return showToast('Username must be at least 3 characters', 'error');
    if (password.length < 4) return showToast('Password must be at least 4 characters', 'error');

    try {
      const data = await API.post('/api/auth/register', { username, password });
      localStorage.setItem('isCreator', 'true');
      showToast('Account created!');
      setTimeout(() => window.location.href = '/dashboard.html', 500);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
});
