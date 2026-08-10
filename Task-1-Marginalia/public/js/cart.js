const basketEl = document.getElementById('basket');
const alertEl = document.getElementById('alert');

const SHIPPING_FEE = 60;
const FREE_SHIPPING_OVER = 999;

let books = [];

(async () => {
  try {
    books = await Api.get('/books');
  } catch {
    showAlert('The catalogue could not be loaded, so prices may be missing.');
  }
  render();
})();

async function render() {
  const lines = CartStore.withBooks(books);

  if (!lines.length) {
    basketEl.innerHTML = `
      <div class="notice empty">
        <h2>Your basket is empty</h2>
        <p>Browse the catalogue and add something to read.</p>
        <a class="btn" href="/">Back to the catalogue</a>
      </div>`;
    return;
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
  const user = await Api.currentUser();

  basketEl.innerHTML = `
    <div class="basket-layout">
      <div class="basket-lines">${lines.map(lineHTML).join('')}</div>
      <aside>
        <div class="panel">
          <h2>Summary</h2>
          <div class="row"><span>Subtotal</span><span>${Shell.money(subtotal)}</span></div>
          <div class="row"><span>Shipping</span><span>${shipping ? Shell.money(shipping) : 'Free'}</span></div>
          <div class="row grand"><span>Total</span><span>${Shell.money(subtotal + shipping)}</span></div>
          ${shipping ? `<p class="hint">Spend ${Shell.money(FREE_SHIPPING_OVER - subtotal)} more for free shipping.</p>` : ''}
        </div>
        <div class="panel">
          <h2>Delivery</h2>
          ${user ? '' : '<p class="hint">You will be asked to sign in before the order is placed.</p>'}
          <label>Name<input id="f-name" value="${user ? Shell.escapeHtml(user.name) : ''}" /></label>
          <label>Address<input id="f-line1" placeholder="Flat, street" /></label>
          <label>City<input id="f-city" /></label>
          <label>Postcode<input id="f-postcode" /></label>
          <button class="btn block" id="place">Place order · ${Shell.money(subtotal + shipping)}</button>
        </div>
      </aside>
    </div>`;

  wireLines();
  document.getElementById('place').addEventListener('click', placeOrder);
}

function wireLines() {
  basketEl.querySelectorAll('[data-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const line = CartStore.read().find((l) => l.id === id);
      CartStore.setQuantity(id, line.quantity + Number(btn.dataset.step));
      render();
    });
  });
  basketEl.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      CartStore.remove(Number(btn.dataset.remove));
      render();
    });
  });
}

function lineHTML(line) {
  return `
    <div class="basket-line">
      ${Shell.coverHTML(line, 'cover-small')}
      <div>
        <a class="book-title" href="/book.html?slug=${encodeURIComponent(line.slug)}">${Shell.escapeHtml(line.title)}</a>
        <span class="book-author">${Shell.escapeHtml(line.author)}</span>
        <span class="unit">${Shell.money(line.price)} each</span>
        <div class="line-controls">
          <div class="stepper">
            <button data-step="-1" data-id="${line.id}" aria-label="Fewer copies">-</button>
            <span>${line.quantity}</span>
            <button data-step="1" data-id="${line.id}" aria-label="More copies">+</button>
          </div>
          <button class="link-btn" data-remove="${line.id}">Remove</button>
        </div>
      </div>
      <span class="line-total">${Shell.money(line.lineTotal)}</span>
    </div>`;
}

async function placeOrder() {
  alertEl.innerHTML = '';

  if (!(await Api.currentUser())) {
    sessionStorage.setItem('marginalia-address', JSON.stringify(readAddress()));
    window.location.href = `/login.html?next=${encodeURIComponent('/cart.html')}`;
    return;
  }

  const address = readAddress();
  if (!address.name || !address.line1 || !address.city) {
    showAlert('Please fill in your name, address, and city.');
    return;
  }

  const button = document.getElementById('place');
  button.disabled = true;
  button.textContent = 'Placing order…';

  try {
    const order = await Api.post('/orders', { items: CartStore.read(), address });
    CartStore.clear();
    sessionStorage.removeItem('marginalia-address');
    window.location.href = `/orders.html?placed=${order.id}`;
  } catch (err) {
    showAlert(err.message);
    render();
  }
}

function readAddress() {
  const value = (id) => document.getElementById(id).value.trim();
  return { name: value('f-name'), line1: value('f-line1'), city: value('f-city'), postcode: value('f-postcode') };
}

function showAlert(message) {
  alertEl.innerHTML = `<div class="alert">${Shell.escapeHtml(message)}</div>`;
}
