// Files go peer to peer over the data channels, in chunks. Nothing is uploaded
// to the server, so a transfer is limited by the browsers, not by disk space
// on the host.
const Transfer = (() => {
  const CHUNK_SIZE = 16 * 1024;
  const BUFFER_CEILING = 512 * 1024;
  const MAX_FILE_BYTES = 100 * 1024 * 1024;

  const incoming = new Map();
  const activeIncomingByPeer = new Map();
  let outgoingInFlight = false;
  let onProgress = () => {};
  let onComplete = () => {};

  function init(handlers) {
    onProgress = handlers.onProgress;
    onComplete = handlers.onComplete;
  }

  function nextId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function send(file) {
    if (outgoingInFlight) throw new Error('Wait for the current file to finish sending.');
    if (file.size > MAX_FILE_BYTES) {
      throw new Error('Files are limited to 100 MB.');
    }

    const channels = Peers.openChannels();
    if (!channels.length) throw new Error('Nobody else is here to receive it.');

    const id = nextId();
    const meta = { kind: 'file-start', id, name: file.name, size: file.size, mime: file.type };
    outgoingInFlight = true;
    try {
      channels.forEach((channel) => channel.send(JSON.stringify(meta)));

      let sent = 0;
      const reader = file.stream().getReader();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        for (let offset = 0; offset < value.byteLength; offset += CHUNK_SIZE) {
          const chunk = value.slice(offset, offset + CHUNK_SIZE);
          for (const channel of channels) {
            await drain(channel);
            channel.send(chunk);
          }
          sent += chunk.byteLength;
          onProgress({ direction: 'out', id, name: file.name, sent, size: file.size });
        }
      }

      channels.forEach((channel) => channel.send(JSON.stringify({ kind: 'file-end', id })));
      onComplete({ direction: 'out', id, name: file.name, size: file.size });
    } finally {
      outgoingInFlight = false;
    }
  }

  // Data channels drop messages if the send buffer is allowed to run away, so
  // wait for it to drain before queueing more.
  function drain(channel) {
    if (channel.bufferedAmount < BUFFER_CEILING) return Promise.resolve();
    return new Promise((resolve) => {
      channel.bufferedAmountLowThreshold = BUFFER_CEILING / 2;
      channel.addEventListener('bufferedamountlow', resolve, { once: true });
    });
  }

  function startReceiving(peerId, meta) {
    if (activeIncomingByPeer.has(peerId)) return;
    incoming.set(`${peerId}:${meta.id}`, { ...meta, chunks: [], received: 0, peerId });
    activeIncomingByPeer.set(peerId, meta.id);
  }

  // Binary messages belong to the currently active transfer from that peer.
  function receiveChunk(peerId, buffer) {
    const transferId = activeIncomingByPeer.get(peerId);
    if (!transferId) return;
    const transfer = incoming.get(`${peerId}:${transferId}`);
    if (!transfer) return;

    transfer.chunks.push(buffer);
    transfer.received += buffer.byteLength;
    onProgress({
      direction: 'in',
      id: transfer.id,
      name: transfer.name,
      sent: transfer.received,
      size: transfer.size,
    });
  }

  function finishReceiving(peerId, id, senderName) {
    const key = `${peerId}:${id}`;
    const transfer = incoming.get(key);
    if (!transfer) return;
    incoming.delete(key);
    if (activeIncomingByPeer.get(peerId) === id) activeIncomingByPeer.delete(peerId);

    const blob = new Blob(transfer.chunks, { type: transfer.mime || 'application/octet-stream' });
    onComplete({
      direction: 'in',
      id,
      name: transfer.name,
      size: blob.size,
      from: senderName,
      url: URL.createObjectURL(blob),
    });
  }

  return { init, send, startReceiving, receiveChunk, finishReceiving, MAX_FILE_BYTES };
})();
