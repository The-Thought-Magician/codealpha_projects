const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'doing', label: 'In progress' },
  { key: 'review', label: 'In review' },
  { key: 'done', label: 'Done' },
];

const projectId = Number(new URLSearchParams(location.search).get('project'));
const boardEl = document.getElementById('board');
const titleEl = document.getElementById('project-name');

let tasks = [];
let members = [];

(async () => {
  if (!(await Api.requireUser())) return;
  if (!projectId) {
    boardEl.innerHTML = '<p class="muted">No project was requested.</p>';
    return;
  }

  try {
    const project = await Api.get(`/projects/${projectId}`);
    document.title = `${project.name} · Sightline`;
    titleEl.textContent = project.name;
    document.getElementById('project-description').textContent = project.description;
  } catch (err) {
    boardEl.innerHTML = `<p class="muted">${Shell.escapeHtml(err.message)}</p>`;
    return;
  }

  members = await Api.get(`/projects/${projectId}/members`);
  tasks = await Api.get(`/projects/${projectId}/tasks`);
  render();

  TaskDialog.init({ projectId, members, onChange: applyLocal, onRemove: removeLocal });
  Members.init({ projectId, members });

  Live.connect(projectId);
  Live.on('task.saved', announceSaved);
  Live.on('task.removed', ({ taskId }) => {
    if (!tasks.some((t) => t.id === taskId)) return;
    removeLocal(taskId);
    Shell.toast('A task was deleted');
  });
  Live.on('comment.added', TaskDialog.receiveComment);

  document.getElementById('add-task').addEventListener('click', () => TaskDialog.openNew());
})();

// Broadcasts also come back to whoever caused them, so only say something when
// the board actually changes.
function announceSaved({ task }) {
  const known = tasks.find((t) => t.id === task.id);
  const changed = !known || JSON.stringify(known) !== JSON.stringify(task);
  applyLocal(task);
  if (changed) Shell.toast(`"${task.title}" was updated`);
}

function applyLocal(task) {
  const index = tasks.findIndex((t) => t.id === task.id);
  if (index === -1) tasks.push(task);
  else tasks[index] = task;
  render();
}

function removeLocal(taskId) {
  tasks = tasks.filter((t) => t.id !== taskId);
  render();
}

function render() {
  boardEl.innerHTML = COLUMNS.map(columnHTML).join('');
  boardEl.querySelectorAll('.column').forEach(wireColumn);
  boardEl.querySelectorAll('.card').forEach(wireCard);
}

function columnHTML(column) {
  const cards = tasks
    .filter((t) => t.status === column.key)
    .sort((a, b) => a.position - b.position || a.id - b.id);

  return `
    <section class="column" data-status="${column.key}">
      <header>
        <h2>${column.label}</h2>
        <span class="count">${cards.length}</span>
      </header>
      <div class="cards">${cards.map(cardHTML).join('')}</div>
    </section>`;
}

function cardHTML(task) {
  return `
    <article class="card" draggable="true" data-task="${task.id}">
      <p class="card-title">${Shell.escapeHtml(task.title)}</p>
      <div class="card-foot">
        ${task.assignee ? Shell.avatarHTML(task.assignee, 'tiny') : '<span class="muted small">Unassigned</span>'}
        ${task.commentCount
          ? `<span class="muted small">${task.commentCount} ${task.commentCount === 1 ? 'comment' : 'comments'}</span>`
          : ''}
      </div>
    </article>`;
}

function wireCard(card) {
  card.addEventListener('click', () => {
    TaskDialog.open(tasks.find((t) => t.id === Number(card.dataset.task)));
  });
  card.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('text/plain', card.dataset.task);
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
}

// Dropping onto a column moves the task to the end of that column. The card
// moves immediately and is put back if the request fails.
function wireColumn(column) {
  column.addEventListener('dragover', (event) => {
    event.preventDefault();
    column.classList.add('over');
  });
  column.addEventListener('dragleave', () => column.classList.remove('over'));

  column.addEventListener('drop', async (event) => {
    event.preventDefault();
    column.classList.remove('over');

    const taskId = Number(event.dataTransfer.getData('text/plain'));
    const task = tasks.find((t) => t.id === taskId);
    const status = column.dataset.status;
    if (!task || task.status === status) return;

    const previous = { status: task.status, position: task.position };
    const position = Math.max(0, ...tasks.filter((t) => t.status === status).map((t) => t.position)) + 1;

    applyLocal({ ...task, status, position });
    try {
      applyLocal(await Api.patch(`/tasks/${taskId}`, { status, position }));
    } catch (err) {
      applyLocal({ ...task, ...previous });
      Shell.toast(err.message);
    }
  });
}
