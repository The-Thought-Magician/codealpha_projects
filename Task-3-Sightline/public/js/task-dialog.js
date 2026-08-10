const TaskDialog = (() => {
  const dialog = document.getElementById('task-dialog');
  const form = dialog.querySelector('form');
  const commentsEl = dialog.querySelector('[data-comments]');
  const commentForm = dialog.querySelector('[data-comment-form]');

  let config = {};
  let current = null;

  function init(options) {
    config = options;
    form.elements.assigneeId.innerHTML =
      '<option value="">Unassigned</option>' +
      config.members.map((m) => `<option value="${m.id}">${Shell.escapeHtml(m.name)}</option>`).join('');

    form.addEventListener('submit', save);
    commentForm.addEventListener('submit', addComment);
    dialog.querySelector('[data-delete]').addEventListener('click', remove);
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  }

  function openNew() {
    current = null;
    fill({ title: '', body: '', status: 'todo', assignee: null });
    dialog.querySelector('[data-delete]').hidden = true;
    setCommentsVisible(false);
    dialog.showModal();
    form.elements.title.focus();
  }

  function open(task) {
    if (!task) return;
    current = task;
    fill(task);
    dialog.querySelector('[data-delete]').hidden = false;
    setCommentsVisible(true);
    dialog.showModal();
    loadComments(task.id);
  }

  function fill(task) {
    form.elements.title.value = task.title;
    form.elements.body.value = task.body;
    form.elements.status.value = task.status;
    form.elements.assigneeId.value = task.assignee ? task.assignee.id : '';
  }

  function setCommentsVisible(visible) {
    dialog.querySelector('[data-comment-section]').hidden = !visible;
    commentsEl.innerHTML = '';
  }

  async function save(event) {
    event.preventDefault();
    const payload = {
      title: form.elements.title.value.trim(),
      body: form.elements.body.value.trim(),
      status: form.elements.status.value,
      assigneeId: form.elements.assigneeId.value || null,
    };

    try {
      const task = current
        ? await Api.patch(`/tasks/${current.id}`, payload)
        : await Api.post(`/projects/${config.projectId}/tasks`, payload);
      config.onChange(task);
      dialog.close();
    } catch (err) {
      Shell.toast(err.message);
    }
  }

  async function remove() {
    if (!current || !confirm('Delete this task?')) return;
    try {
      await Api.del(`/tasks/${current.id}`);
      config.onRemove(current.id);
      dialog.close();
    } catch (err) {
      Shell.toast(err.message);
    }
  }

  async function loadComments(taskId) {
    commentsEl.innerHTML = '<p class="muted small">Loading…</p>';
    try {
      const comments = await Api.get(`/tasks/${taskId}/comments`);
      commentsEl.innerHTML = comments.map(commentHTML).join('')
        || '<p class="muted small">No comments yet.</p>';
    } catch (err) {
      commentsEl.innerHTML = `<p class="muted small">${Shell.escapeHtml(err.message)}</p>`;
    }
  }

  function commentHTML(comment) {
    return `
      <div class="comment" data-comment="${comment.id}">
        ${Shell.avatarHTML(comment.author, 'tiny')}
        <div>
          <span class="name">${Shell.escapeHtml(comment.author.name)}</span>
          <span class="muted small">${Shell.timeAgo(comment.createdAt)}</span>
          <p>${Shell.escapeHtml(comment.body)}</p>
        </div>
      </div>`;
  }

  async function addComment(event) {
    event.preventDefault();
    const input = commentForm.elements.body;
    const body = input.value.trim();
    if (!body || !current) return;

    try {
      const comment = await Api.post(`/tasks/${current.id}/comments`, { body });
      const placeholder = commentsEl.querySelector('.muted');
      if (placeholder) placeholder.remove();
      commentsEl.insertAdjacentHTML('beforeend', commentHTML(comment));
      input.value = '';
    } catch (err) {
      Shell.toast(err.message);
    }
  }

  // Fires for every comment on the board, including the ones this tab just
  // posted, so skip anything already on screen.
  function receiveComment({ taskId, comment }) {
    if (!current || current.id !== taskId || !dialog.open) return;
    if (commentsEl.querySelector(`[data-comment="${comment.id}"]`)) return;
    const placeholder = commentsEl.querySelector('.muted');
    if (placeholder) placeholder.remove();
    commentsEl.insertAdjacentHTML('beforeend', commentHTML(comment));
  }

  return { init, open, openNew, receiveComment };
})();
