const next = new URLSearchParams(location.search).get('next') || '/';
const form = document.getElementById('form');
const alertEl = document.getElementById('alert');
const nameField = document.getElementById('name-field');

let mode = 'signin';

Api.currentUser().then((user) => { if (user) window.location.href = next; });

document.getElementById('switch').addEventListener('click', (e) => {
  e.preventDefault();
  setMode(mode === 'signin' ? 'register' : 'signin');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertEl.innerHTML = '';

  const submit = document.getElementById('submit');
  submit.disabled = true;

  const body = {
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
  };
  if (mode === 'register') body.name = document.getElementById('name').value.trim();

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
  document.getElementById('title').textContent = registering ? 'Create an account' : 'Sign in';
  document.getElementById('submit').textContent = registering ? 'Create account' : 'Sign in';
  document.getElementById('switch').textContent = registering ? 'Sign in instead' : 'Create an account';
  document.getElementById('switch-text').textContent = registering
    ? 'Already have an account?'
    : 'New to Marginalia?';
  document.getElementById('name').required = registering;
  nameField.hidden = !registering;
  alertEl.innerHTML = '';
}
