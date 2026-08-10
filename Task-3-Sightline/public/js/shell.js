const Shell = (() => {
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function timeAgo(iso) {
    const seconds = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function initials(name) {
    return String(name || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  function avatarHTML(person, size = '') {
    if (!person) return '';
    const hue = [...String(person.name || '')].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 360;
    return `<span class="avatar ${size}" style="--hue:${hue}" title="${escapeHtml(person.name)}">${initials(person.name)}</span>`;
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
    el._timer = setTimeout(() => el.classList.remove('visible'), 2600);
  }

  async function renderHeader() {
    const host = document.querySelector('[data-header]');
    if (!host) return;

    const user = await Api.currentUser();
    host.innerHTML = `
      <header class="topbar">
        <div class="bar-inner">
          <a class="wordmark" href="/">Sightline</a>
          <div class="bar-right">
            ${user ? `
              <span class="who">${avatarHTML(user, 'tiny')} ${escapeHtml(user.name)}</span>
              <button class="link-btn" data-logout>Sign out</button>
            ` : '<a href="/login.html">Sign in</a>'}
          </div>
        </div>
      </header>`;

    const logout = host.querySelector('[data-logout]');
    if (logout) {
      logout.addEventListener('click', async () => {
        await Api.post('/logout');
        Api.setUser(null);
        window.location.href = '/login.html';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', renderHeader);

  return { escapeHtml, timeAgo, avatarHTML, initials, toast };
})();
