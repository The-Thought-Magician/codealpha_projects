// Keeps one WebSocket open per board and hands events to whoever subscribed.
// Reconnects with a widening delay so a server restart does not need a refresh.
const Live = (() => {
  const handlers = new Map();
  let socket = null;
  let projectId = null;
  let retryDelay = 1000;
  let statusEl = null;

  function connect(id) {
    projectId = id;
    open();
  }

  function open() {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${scheme}://${location.host}/live?project=${projectId}`);

    socket.addEventListener('open', () => {
      retryDelay = 1000;
      setStatus('live', 'Live');
    });

    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);
      (handlers.get(payload.type) || []).forEach((fn) => fn(payload));
    });

    socket.addEventListener('close', (event) => {
      // 4001 means the server rejected us, so retrying will not help.
      if (event.code === 4001) return setStatus('off', 'Not connected');
      setStatus('off', 'Reconnecting…');
      setTimeout(open, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 15000);
    });
  }

  function on(type, handler) {
    if (!handlers.has(type)) handlers.set(type, []);
    handlers.get(type).push(handler);
  }

  function setStatus(state, label) {
    if (!statusEl) statusEl = document.getElementById('live-status');
    if (!statusEl) return;
    statusEl.textContent = label;
    statusEl.className = `live-status ${state}`;
  }

  return { connect, on };
})();
