const listEl = document.getElementById('projects');
const form = document.getElementById('new-project');

(async () => {
  if (!(await Api.requireUser())) return;
  load();
  form.addEventListener('submit', create);
})();

async function load() {
  listEl.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const projects = await Api.get('/projects');
    listEl.innerHTML = projects.length
      ? projects.map(cardHTML).join('')
      : `<div class="empty">
           <h2>No projects yet</h2>
           <p>Create one on the right, then invite the people you work with.</p>
         </div>`;
  } catch (err) {
    listEl.innerHTML = `<p class="muted">${Shell.escapeHtml(err.message)}</p>`;
  }
}

async function create(event) {
  event.preventDefault();
  const data = new FormData(form);
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;

  try {
    const project = await Api.post('/projects', {
      name: data.get('name'),
      description: data.get('description'),
    });
    window.location.href = `/board.html?project=${project.id}`;
  } catch (err) {
    Shell.toast(err.message);
    button.disabled = false;
  }
}

function cardHTML(project) {
  return `
    <a class="project-card" href="/board.html?project=${project.id}">
      <div class="project-top">
        <h2>${Shell.escapeHtml(project.name)}</h2>
        ${project.role === 'owner' ? '<span class="tag">Owner</span>' : ''}
      </div>
      <p>${Shell.escapeHtml(project.description) || 'No description yet.'}</p>
      <span class="muted small">
        ${project.memberCount} ${project.memberCount === 1 ? 'member' : 'members'} ·
        ${project.openCount} open ${project.openCount === 1 ? 'task' : 'tasks'}
      </span>
    </a>`;
}
