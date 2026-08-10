// The video grid and the list of who is in the room.
const Tiles = (() => {
  const grid = document.getElementById('grid');
  const rosterEl = document.getElementById('roster');
  const countEl = document.getElementById('peer-count');

  const names = new Map();
  let myName = 'You';

  function setLocal(stream, name) {
    myName = name;
    const tile = build('local', `${name} (you)`);
    const video = tile.querySelector('video');
    video.srcObject = stream;
    video.muted = true;
    grid.prepend(tile);
    refreshRoster();
  }

  function add(peerId, name, stream) {
    const existing = document.getElementById(`tile-${peerId}`);
    if (existing) {
      existing.querySelector('video').srcObject = stream;
      return;
    }
    const tile = build(peerId, name);
    tile.querySelector('video').srcObject = stream;
    grid.append(tile);
    names.set(peerId, name);
    refreshRoster();
  }

  function remove(peerId) {
    const tile = document.getElementById(`tile-${peerId}`);
    if (tile) tile.remove();
    names.delete(peerId);
    refreshRoster();
  }

  function build(id, label) {
    const tile = document.createElement('figure');
    tile.className = 'tile';
    tile.id = `tile-${id}`;
    tile.innerHTML = `
      <video autoplay playsinline></video>
      <figcaption>${Shell.escapeHtml(label)}</figcaption>`;
    return tile;
  }

  function note(peerId, name) {
    names.set(peerId, name);
    refreshRoster();
  }

  function refreshRoster() {
    const everyone = [myName, ...names.values()];
    countEl.textContent = everyone.length;
    rosterEl.innerHTML = everyone
      .map((name) => `<li>${Shell.avatarHTML({ name }, 'tiny')} ${Shell.escapeHtml(name)}</li>`)
      .join('');
  }

  return { setLocal, add, remove, note };
})();
