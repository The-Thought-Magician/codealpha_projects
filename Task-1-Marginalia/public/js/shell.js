const Shell = (() => {
  function money(amount) {
    return `₹${Math.round(Number(amount)).toLocaleString('en-IN')}`;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Covers are drawn from the title rather than shipped as images, so the
  // catalogue has no binary assets to keep in sync.
  function coverHTML(book, extraClass = '') {
    const hue = [...book.slug].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 360;
    return `
      <div class="cover ${extraClass}" style="--cover-hue:${hue}">
        <span class="cover-title">${escapeHtml(book.title)}</span>
        <span class="cover-author">${escapeHtml(book.author)}</span>
      </div>`;
  }

  function toast(message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('visible'), 2400);
  }

  function updateCartBadge() {
    const badge = document.querySelector('[data-cart-count]');
    if (badge) badge.textContent = CartStore.count();
  }

  async function renderHeader() {
    const host = document.querySelector('[data-header]');
    if (!host) return;

    const user = await Api.currentUser();
    const account = user
      ? `<a href="/orders.html">Orders</a><button class="link-btn" data-logout>Sign out</button>`
      : `<a href="/login.html">Sign in</a>`;

    host.innerHTML = `
      <header class="masthead">
        <div class="container">
          <a class="wordmark" href="/">Marginalia</a>
          <nav>
            <a href="/">Catalogue</a>
            <a href="/cart.html">Basket <span class="badge" data-cart-count>0</span></a>
            ${account}
          </nav>
        </div>
      </header>`;

    const logout = host.querySelector('[data-logout]');
    if (logout) {
      logout.addEventListener('click', async () => {
        await Api.post('/logout');
        Api.setUser(null);
        window.location.href = '/';
      });
    }
    updateCartBadge();
  }

  document.addEventListener('DOMContentLoaded', renderHeader);
  document.addEventListener('cart:changed', updateCartBadge);

  return { money, escapeHtml, coverHTML, toast, renderHeader };
})();
