const next = new URLSearchParams(location.search).get('next') || '/';
const form = document.getElementById('form');
const alertEl = document.getElementById('alert');

let mode = 'signin';

Api.currentUser().then((user) => { if (user) window.location.href = next; });

document.getElementById('switch').addEventListener('click', (event) => {
  event.preventDefault();
  setMode(mode === 'signin' ? 'register' : 'signin');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  alertEl.innerHTML = '';

  const submit = document.getElementById('submit');
  submit.disabled = true;

  const data = new FormData(form);
  const body = { email: data.get('email').trim(), password: data.get('password') };
  if (mode === 'register') {
    body.handle = data.get('handle').trim();
    body.displayName = data.get('displayName').trim();
  }

  try {
    const { user } = await Api.post(mode === 'register' ? '/register' : '/login', body);
    Api.setUser(user);
    window.location.href = next;
  } catch (err) {
    alertEl.innerHTML = `<div class="alert">${Shell.escapeHtml(err.message)}</div>`;
    submit.disabled = false;
  }
});

function setMode(value) {
  mode = value;
  const registering = value === 'register';
  document.getElementById('title').textContent = registering ? 'Join Coterie' : 'Sign in';
  document.getElementById('submit').textContent = registering ? 'Create account' : 'Sign in';
  document.getElementById('switch').textContent = registering ? 'Sign in instead' : 'Create an account';
  document.getElementById('switch-text').textContent = registering
    ? 'Already have an account?'
    : 'New here?';

  document.getElementById('register-fields').hidden = !registering;
  form.elements.handle.required = registering;
  form.elements.displayName.required = registering;
  alertEl.innerHTML = '';
}
