document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('auth-form');
  const errorBox = document.getElementById('error');
  const mode = form.dataset.mode;

  const showError = (msg) => {
    errorBox.textContent = msg;
    errorBox.classList.remove('d-none');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('d-none');

    const body = {
      email: form.email.value.trim(),
      password: form.password.value,
    };
    if (mode === 'register') {
      body.name = form.name.value.trim();
      if (body.name.length < 2) return showError('Enter your name.');
      if (body.password.length < 8) return showError('Password must be at least 8 characters.');
    }
    if (!body.email || !body.password) return showError('Enter your email and password.');

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await App.api(`/api/auth/${mode}`, { method: 'POST', body });
      location.href = App.safeNext();
    } catch (err) {
      showError(err.message);
      btn.disabled = false;
    }
  });
});
