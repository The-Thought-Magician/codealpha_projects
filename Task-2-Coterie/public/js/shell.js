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
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Initials stand in for avatars, so there are no uploads to store or serve.
  function avatarHTML(person, size = '') {
    const initials = (person.displayName || person.handle || '?').trim().slice(0, 1).toUpperCase();
    const hue = [...(person.handle || '')].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 360;
    return `<span class="avatar ${size}" style="--hue:${hue}">${escapeHtml(initials)}</span>`;
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

  async function renderHeader() {
    const host = document.querySelector('[data-header]');
    if (!host) return;

    const user = await Api.currentUser();
    host.innerHTML = `
      <header class="topbar">
        <div class="container">
          <a class="wordmark" href="/">Coterie</a>
          <nav>
            ${user ? `
              <a href="/">Feed</a>
              <a href="/circles.html">Circles</a>
              <a href="/profile.html?handle=${encodeURIComponent(user.handle)}">
                ${avatarHTML(user, 'tiny')} ${escapeHtml(user.displayName)}
              </a>
              <button class="link-btn" data-logout>Sign out</button>
            ` : '<a href="/login.html">Sign in</a>'}
          </nav>
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

  return { escapeHtml, timeAgo, avatarHTML, toast };
})();
