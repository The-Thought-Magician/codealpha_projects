const listEl = document.getElementById('orders');
const alertEl = document.getElementById('alert');

(async () => {
  if (!(await Api.currentUser())) {
    window.location.href = `/login.html?next=${encodeURIComponent('/orders.html')}`;
    return;
  }

  const placed = new URLSearchParams(location.search).get('placed');
  if (placed) {
    alertEl.innerHTML = `<div class="alert success">Order #${Shell.escapeHtml(placed)} is confirmed.</div>`;
  }

  try {
    const orders = await Api.get('/orders');
    listEl.innerHTML = orders.length
      ? orders.map(orderHTML).join('')
      : `<div class="notice empty">
           <h2>No orders yet</h2>
           <p>Anything you buy will be listed here.</p>
           <a class="btn" href="/">Start browsing</a>
         </div>`;
  } catch (err) {
    listEl.innerHTML = `<p class="notice">${Shell.escapeHtml(err.message)}</p>`;
  }
})();

function orderHTML(order) {
  const a = order.address;
  return `
    <article class="order">
      <div class="order-head">
        <div>
          <strong>Order #${order.id}</strong>
          <span class="order-date">${new Date(order.createdAt).toLocaleString()}</span>
        </div>
        <span class="status">${Shell.escapeHtml(order.status)}</span>
      </div>
      ${order.items.map(itemHTML).join('')}
      <div class="order-row"><span>Shipping</span><span>${order.shipping ? Shell.money(order.shipping) : 'Free'}</span></div>
      <div class="order-row grand"><span>Total</span><span>${Shell.money(order.total)}</span></div>
      <p class="order-address">
        Delivered to ${Shell.escapeHtml(a.name)}, ${Shell.escapeHtml(a.line1)},
        ${Shell.escapeHtml(a.city)} ${Shell.escapeHtml(a.postcode || '')}
      </p>
    </article>`;
}

function itemHTML(item) {
  return `
    <div class="order-row">
      <span>${item.quantity} × ${Shell.escapeHtml(item.title)}
        <small>${Shell.escapeHtml(item.author)}</small></span>
      <span>${Shell.money(item.price * item.quantity)}</span>
    </div>`;
}
