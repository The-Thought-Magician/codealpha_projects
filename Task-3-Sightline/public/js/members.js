const Members = (() => {
  const dialog = document.getElementById('members-dialog');
  const listEl = dialog.querySelector('[data-member-list]');
  const form = dialog.querySelector('form');

  let config = {};

  function init(options) {
    config = options;
    render();

    document.getElementById('open-members').addEventListener('click', () => dialog.showModal());
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', invite);
  }

  function render() {
    listEl.innerHTML = config.members.map((member) => `
      <div class="member">
        ${Shell.avatarHTML(member, 'tiny')}
        <div>
          <span class="name">${Shell.escapeHtml(member.name)}</span>
          <span class="muted small">${Shell.escapeHtml(member.email)}</span>
        </div>
        ${member.role === 'owner' ? '<span class="tag">Owner</span>' : ''}
      </div>`).join('');
  }

  async function invite(event) {
    event.preventDefault();
    const input = form.elements.email;
    const email = input.value.trim();
    if (!email) return;

    try {
      const member = await Api.post(`/projects/${config.projectId}/members`, { email });
      if (!config.members.some((m) => m.id === member.id)) config.members.push(member);
      render();
      input.value = '';
      Shell.toast(`${member.name} was added to the project.`);
    } catch (err) {
      Shell.toast(err.message);
    }
  }

  return { init };
})();
