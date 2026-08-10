const headerEl = document.getElementById('profile-header');
const feedEl = document.getElementById('feed');
const handle = new URLSearchParams(location.search).get('handle');

(async () => {
  const me = await Api.requireUser();
  if (!me) return;
  if (!handle) {
    window.location.replace(`/profile.html?handle=${encodeURIComponent(me.handle)}`);
    return;
  }

  PostCard.wire(feedEl);

  try {
    const profile = await Api.get(`/users/${encodeURIComponent(handle)}`);
    document.title = `${profile.displayName} · Coterie`;
    renderHeader(profile);
  } catch (err) {
    headerEl.innerHTML = `<p class="muted">${Shell.escapeHtml(err.message)}</p>`;
    return;
  }

  loadPosts();
})();

function renderHeader(profile) {
  const action = profile.isMe
    ? '<button class="chip-btn" id="edit">Edit profile</button>'
    : `<button class="chip-btn ${profile.following ? 'on' : ''}" id="follow">
         ${profile.following ? 'Following' : 'Follow'}
       </button>`;

  headerEl.innerHTML = `
    ${Shell.avatarHTML(profile, 'large')}
    <div>
      <h1>${Shell.escapeHtml(profile.displayName)}</h1>
      <p class="handle">@${Shell.escapeHtml(profile.handle)}</p>
      ${profile.bio ? `<p class="bio">${Shell.escapeHtml(profile.bio)}</p>` : ''}
      <p class="counts">
        <strong>${profile.postCount}</strong> posts ·
        <strong data-followers>${profile.followerCount}</strong> followers ·
        <strong>${profile.followingCount}</strong> following
      </p>
      <p class="muted small">Joined ${new Date(profile.joined).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
      ${action}
    </div>`;

  const follow = document.getElementById('follow');
  if (follow) follow.addEventListener('click', () => toggleFollow(follow));

  const edit = document.getElementById('edit');
  if (edit) edit.addEventListener('click', () => openEditor(profile));
}

async function toggleFollow(button) {
  button.disabled = true;
  try {
    const result = await Api.post(`/users/${encodeURIComponent(handle)}/follow`);
    button.textContent = result.following ? 'Following' : 'Follow';
    button.classList.toggle('on', result.following);
    headerEl.querySelector('[data-followers]').textContent = result.followerCount;
  } catch (err) {
    Shell.toast(err.message);
  } finally {
    button.disabled = false;
  }
}

function openEditor(profile) {
  const dialog = document.getElementById('editor');
  dialog.querySelector('[name=displayName]').value = profile.displayName;
  dialog.querySelector('[name=bio]').value = profile.bio;
  dialog.showModal();

  dialog.querySelector('form').onsubmit = async (event) => {
    if (event.submitter && event.submitter.value === 'cancel') return;
    event.preventDefault();
    const data = new FormData(event.target);
    try {
      const updated = await Api.put('/users/me', {
        displayName: data.get('displayName'),
        bio: data.get('bio'),
      });
      Api.setUser({ ...profile, displayName: updated.displayName, bio: updated.bio });
      dialog.close();
      renderHeader(updated);
      Shell.toast('Profile updated.');
    } catch (err) {
      Shell.toast(err.message);
    }
  };
}

async function loadPosts() {
  feedEl.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const posts = await Api.get(`/users/${encodeURIComponent(handle)}/posts`);
    feedEl.innerHTML = posts.length
      ? posts.map(PostCard.html).join('')
      : '<div class="empty"><h2>No posts yet</h2></div>';
  } catch (err) {
    feedEl.innerHTML = `<p class="muted">${Shell.escapeHtml(err.message)}</p>`;
  }
}
