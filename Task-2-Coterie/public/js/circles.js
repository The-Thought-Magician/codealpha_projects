const listEl = document.getElementById('circles');

(async () => {
  if (!(await Api.requireUser())) return;
  load();

  listEl.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-join]');
    if (!button) return;
    button.disabled = true;
    try {
      const result = await Api.post(`/circles/${button.dataset.join}/join`);
      button.textContent = result.joined ? 'Joined' : 'Join';
      button.classList.toggle('on', result.joined);
      button.closest('.circle-card').querySelector('[data-members]').textContent = result.memberCount;
    } catch (err) {
      Shell.toast(err.message);
    } finally {
      button.disabled = false;
    }
  });
})();

async function load() {
  listEl.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const circles = await Api.get('/circles');
    listEl.innerHTML = circles.map(cardHTML).join('');
  } catch (err) {
    listEl.innerHTML = `<p class="muted">${Shell.escapeHtml(err.message)}</p>`;
  }
}

function cardHTML(circle) {
  const href = `/circle.html?slug=${encodeURIComponent(circle.slug)}`;
  return `
    <article class="circle-card">
      <a class="circle-name" href="${href}">${Shell.escapeHtml(circle.name)}</a>
      <p>${Shell.escapeHtml(circle.description)}</p>
      <div class="circle-foot">
        <span class="muted small">
          <span data-members>${circle.memberCount}</span> members · ${circle.postCount} posts
        </span>
        <button class="chip-btn ${circle.joined ? 'on' : ''}" data-join="${Shell.escapeHtml(circle.slug)}">
          ${circle.joined ? 'Joined' : 'Join'}
        </button>
      </div>
    </article>`;
}
