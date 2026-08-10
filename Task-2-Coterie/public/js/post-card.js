const PostCard = (() => {
  function html(post) {
    const circle = post.circle
      ? `<a class="circle-tag" href="/circle.html?slug=${encodeURIComponent(post.circle.slug)}">${Shell.escapeHtml(post.circle.name)}</a>`
      : '';

    return `
      <article class="post" data-post="${post.id}">
        <div class="post-head">
          ${Shell.avatarHTML(post.author)}
          <div class="post-who">
            <a class="name" href="/profile.html?handle=${encodeURIComponent(post.author.handle)}">${Shell.escapeHtml(post.author.displayName)}</a>
            <span class="handle">@${Shell.escapeHtml(post.author.handle)} · ${Shell.timeAgo(post.createdAt)}</span>
          </div>
          ${circle}
          ${post.mine ? '<button class="link-btn danger" data-delete>Delete</button>' : ''}
        </div>
        <p class="post-body">${Shell.escapeHtml(post.body)}</p>
        <div class="post-actions">
          <button class="chip-btn ${post.liked ? 'on' : ''}" data-like>
            <span data-like-label>${post.liked ? 'Liked' : 'Like'}</span>
            <span data-like-count>${post.likeCount}</span>
          </button>
          <button class="chip-btn" data-comments>
            Comments <span data-comment-count>${post.commentCount}</span>
          </button>
        </div>
        <div class="comments" hidden></div>
      </article>`;
  }

  // One delegated listener per container, so re-rendering a feed does not
  // leave old handlers behind.
  function wire(container, { onRemoved } = {}) {
    container.addEventListener('click', async (event) => {
      const article = event.target.closest('[data-post]');
      if (!article) return;
      const postId = Number(article.dataset.post);

      if (event.target.closest('[data-like]')) return toggleLike(article, postId);
      if (event.target.closest('[data-comments]')) return toggleComments(article, postId);
      if (event.target.closest('[data-delete]')) return removePost(article, postId, onRemoved);
      if (event.target.closest('[data-delete-comment]')) {
        return removeComment(article, event.target.closest('[data-delete-comment]'));
      }
    });

    container.addEventListener('submit', async (event) => {
      if (!event.target.matches('[data-comment-form]')) return;
      event.preventDefault();
      const article = event.target.closest('[data-post]');
      await addComment(article, Number(article.dataset.post), event.target);
    });
  }

  async function toggleLike(article, postId) {
    try {
      const result = await Api.post(`/posts/${postId}/like`);
      const button = article.querySelector('[data-like]');
      button.classList.toggle('on', result.liked);
      button.querySelector('[data-like-label]').textContent = result.liked ? 'Liked' : 'Like';
      button.querySelector('[data-like-count]').textContent = result.likeCount;
    } catch (err) {
      Shell.toast(err.message);
    }
  }

  async function toggleComments(article, postId) {
    const box = article.querySelector('.comments');
    if (!box.hidden) {
      box.hidden = true;
      return;
    }

    box.hidden = false;
    box.innerHTML = '<p class="muted">Loading…</p>';
    try {
      const comments = await Api.get(`/posts/${postId}/comments`);
      box.innerHTML = comments.map(commentHTML).join('') + composerHTML();
    } catch (err) {
      box.innerHTML = `<p class="muted">${Shell.escapeHtml(err.message)}</p>`;
    }
  }

  function commentHTML(comment) {
    return `
      <div class="comment" data-comment="${comment.id}">
        ${Shell.avatarHTML(comment.author, 'tiny')}
        <div>
          <span class="name">${Shell.escapeHtml(comment.author.displayName)}</span>
          <span class="handle">${Shell.timeAgo(comment.createdAt)}</span>
          <p>${Shell.escapeHtml(comment.body)}</p>
        </div>
        ${comment.mine ? '<button class="link-btn danger" data-delete-comment>Delete</button>' : ''}
      </div>`;
  }

  function composerHTML() {
    return `
      <form class="comment-form" data-comment-form>
        <input name="body" placeholder="Add a comment" maxlength="400" required />
        <button class="btn small" type="submit">Reply</button>
      </form>`;
  }

  async function addComment(article, postId, form) {
    const input = form.elements.body;
    const body = input.value.trim();
    if (!body) return;

    try {
      const created = await Api.post(`/posts/${postId}/comments`, { body });
      const me = await Api.currentUser();
      form.insertAdjacentHTML('beforebegin', commentHTML({
        ...created,
        author: { handle: me.handle, displayName: me.displayName },
      }));
      input.value = '';
      bumpCount(article, '[data-comment-count]', 1);
    } catch (err) {
      Shell.toast(err.message);
    }
  }

  async function removeComment(article, button) {
    const row = button.closest('[data-comment]');
    try {
      await Api.del(`/posts/comments/${row.dataset.comment}`);
      row.remove();
      bumpCount(article, '[data-comment-count]', -1);
    } catch (err) {
      Shell.toast(err.message);
    }
  }

  async function removePost(article, postId, onRemoved) {
    if (!confirm('Delete this post?')) return;
    try {
      await Api.del(`/posts/${postId}`);
      article.remove();
      if (onRemoved) onRemoved();
    } catch (err) {
      Shell.toast(err.message);
    }
  }

  function bumpCount(article, selector, delta) {
    const el = article.querySelector(selector);
    el.textContent = Math.max(0, Number(el.textContent) + delta);
  }

  return { html, wire };
})();
