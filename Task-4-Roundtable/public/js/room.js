const slug = new URLSearchParams(location.search).get('room');
const statusEl = document.getElementById('status');
const filesEl = document.getElementById('files');

let me = null;

(async () => {
  me = await Api.requireUser();
  if (!me || !slug) return;

  let room;
  try {
    room = await Api.get(`/rooms/${encodeURIComponent(slug)}`);
  } catch (err) {
    return setStatus(err.message, 'bad');
  }
  document.getElementById('room-name').textContent = room.name;
  document.title = `${room.name} · Roundtable`;

  let stream;
  try {
    stream = await Media.start();
  } catch {
    return setStatus('Roundtable needs permission to use your camera and microphone.', 'bad');
  }

  Tiles.setLocal(stream, me.name);
  Whiteboard.init(document.getElementById('board'), document.getElementById('palette'));
  Transfer.init({ onProgress: showProgress, onComplete: showComplete });

  const { iceServers } = await Api.get('/ice');
  Peers.init({
    iceServers,
    localStream: stream,
    onTrack: (peerId, name, remote) => Tiles.add(peerId, name, remote),
    onPeerLeft: (peerId) => Tiles.remove(peerId),
    onChannelOpen: (peerId) => Peers.channelFor(peerId)?.send(JSON.stringify({ kind: 'board-request' })),
    onData: handleData,
  });

  wireControls();
  connectSignalling();
})();

function connectSignalling() {
  Signal.on('welcome', ({ peers }) => {
    setStatus(peers.length ? 'Connecting to the others…' : 'Waiting for someone to join.', 'ok');
    peers.forEach(({ peerId, name }) => {
      Tiles.note(peerId, name);
      Peers.create(peerId, name, true);
    });
  });

  Signal.on('peer-joined', ({ peerId, name }) => {
    Tiles.note(peerId, name);
    setStatus(`${name} joined.`, 'ok');
  });

  Signal.on('signal', ({ from, name, data }) => Peers.handleSignal(from, name, data));
  Signal.on('peer-left', ({ peerId }) => Peers.remove(peerId));
  Signal.on('closed', (event) => {
    if (event.code === 4001 || event.code === 4002) setStatus(event.reason, 'bad');
  });

  Signal.connect(slug);
}

function handleData(peerId, name, raw) {
  if (raw instanceof ArrayBuffer) return Transfer.receiveChunk(peerId, raw);

  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (message.kind === 'stroke') return Whiteboard.receive(message.stroke);
  if (message.kind === 'board-clear') return Whiteboard.clear(false);
  if (message.kind === 'board-request') {
    return Peers.channelFor(peerId)?.send(
      JSON.stringify({ kind: 'board-state', strokes: Whiteboard.snapshot() })
    );
  }
  if (message.kind === 'board-state') return Whiteboard.restore(message.strokes);
  if (message.kind === 'file-start') return Transfer.startReceiving(peerId, message);
  if (message.kind === 'file-end') return Transfer.finishReceiving(peerId, message.id, name);
}

function wireControls() {
  toggle('mic', () => Media.toggleAudio(), 'Microphone on', 'Microphone off');
  toggle('cam', () => Media.toggleVideo(), 'Camera on', 'Camera off');

  document.getElementById('share').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      if (Media.sharingScreen()) {
        await Media.stopScreenShare();
        button.classList.remove('on');
        button.textContent = 'Share screen';
      } else {
        await Media.startScreenShare(() => {
          button.classList.remove('on');
          button.textContent = 'Share screen';
        });
        button.classList.add('on');
        button.textContent = 'Stop sharing';
      }
    } catch {
      setStatus('Screen sharing was cancelled.', 'ok');
    }
  });

  document.getElementById('board-toggle').addEventListener('click', (event) => {
    const panel = document.getElementById('board-panel');
    panel.hidden = !panel.hidden;
    event.currentTarget.classList.toggle('on', !panel.hidden);
    if (!panel.hidden) Whiteboard.resize();
  });

  document.getElementById('board-clear').addEventListener('click', () => Whiteboard.clear());

  document.getElementById('file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await Transfer.send(file);
    } catch (err) {
      setStatus(err.message, 'bad');
    }
    event.target.value = '';
  });

  document.getElementById('copy-link').addEventListener('click', async () => {
    await navigator.clipboard.writeText(location.href);
    setStatus('Room link copied.', 'ok');
  });

  document.getElementById('leave').addEventListener('click', () => {
    Media.stop();
    window.location.href = '/';
  });

  window.addEventListener('beforeunload', () => Media.stop());
}

function toggle(id, action, onLabel, offLabel) {
  document.getElementById(id).addEventListener('click', (event) => {
    const enabled = action();
    event.currentTarget.classList.toggle('off', !enabled);
    event.currentTarget.textContent = enabled ? onLabel : offLabel;
  });
}

function showProgress({ direction, id, name, sent, size }) {
  const rowId = `transfer-${direction}-${id}`;
  let row = document.getElementById(rowId);
  if (!row) {
    row = document.createElement('div');
    row.className = 'transfer';
    row.id = rowId;
    filesEl.prepend(row);
  }
  const percent = Math.round((sent / size) * 100);
  row.innerHTML = `
    <span>${direction === 'out' ? 'Sending' : 'Receiving'} ${Shell.escapeHtml(name)}</span>
    <progress max="100" value="${percent}"></progress>`;
}

function showComplete({ direction, id, name, size, from, url }) {
  const row = document.getElementById(`transfer-${direction}-${id}`);
  const label = direction === 'out'
    ? `Sent ${Shell.escapeHtml(name)}`
    : `${Shell.escapeHtml(from || 'Someone')} sent ${Shell.escapeHtml(name)}`;
  const action = url
    ? `<a download="${Shell.escapeHtml(name)}" href="${url}">Save (${Math.round(size / 1024)} KB)</a>`
    : `<span class="muted small">${Math.round(size / 1024)} KB</span>`;
  const markup = `<span>${label}</span>${action}`;

  if (row) row.innerHTML = markup;
  else filesEl.insertAdjacentHTML('afterbegin', `<div class="transfer">${markup}</div>`);
}

function setStatus(message, tone) {
  statusEl.textContent = message;
  statusEl.className = `status ${tone}`;
}
