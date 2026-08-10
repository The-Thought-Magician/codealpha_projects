// A full mesh: every browser holds one RTCPeerConnection per other person in
// the room. Fine for a small meeting, which is why the server caps the room
// size; a larger call would need a selective forwarding unit instead.
const Peers = (() => {
  const connections = new Map();
  let config = {};

  function init(options) {
    config = options;
  }

  function get(peerId) {
    return connections.get(peerId);
  }

  function names() {
    return [...connections].map(([peerId, peer]) => ({ peerId, name: peer.name }));
  }

  function create(peerId, name, initiator) {
    if (connections.has(peerId)) return connections.get(peerId);

    const connection = new RTCPeerConnection({ iceServers: config.iceServers });
    const peer = { connection, name, channel: null, pendingCandidates: [] };
    connections.set(peerId, peer);

    for (const track of config.localStream.getTracks()) {
      connection.addTrack(track, config.localStream);
    }

    connection.addEventListener('icecandidate', (event) => {
      if (event.candidate) Signal.send(peerId, { candidate: event.candidate });
    });

    connection.addEventListener('track', (event) => {
      config.onTrack(peerId, name, event.streams[0]);
    });

    connection.addEventListener('connectionstatechange', () => {
      if (['failed', 'closed'].includes(connection.connectionState)) remove(peerId);
    });

    if (initiator) {
      attachChannel(peerId, peer, connection.createDataChannel('room', { ordered: true }));
      negotiate(peerId, peer);
    } else {
      connection.addEventListener('datachannel', (event) => {
        attachChannel(peerId, peer, event.channel);
      });
    }

    return peer;
  }

  function attachChannel(peerId, peer, channel) {
    peer.channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.addEventListener('open', () => config.onChannelOpen(peerId));
    channel.addEventListener('message', (event) => config.onData(peerId, peer.name, event.data));
  }

  async function negotiate(peerId, peer) {
    const offer = await peer.connection.createOffer();
    await peer.connection.setLocalDescription(offer);
    Signal.send(peerId, { description: peer.connection.localDescription });
  }

  // Candidates can arrive before the remote description is set, so they are
  // held back until there is somewhere to put them.
  async function handleSignal(peerId, name, data) {
    const peer = connections.get(peerId) || create(peerId, name, false);
    const { connection } = peer;

    if (data.description) {
      await connection.setRemoteDescription(data.description);
      for (const candidate of peer.pendingCandidates.splice(0)) {
        await connection.addIceCandidate(candidate).catch(() => {});
      }
      if (data.description.type === 'offer') {
        await connection.setLocalDescription(await connection.createAnswer());
        Signal.send(peerId, { description: connection.localDescription });
      }
      return;
    }

    if (data.candidate) {
      if (connection.remoteDescription) {
        await connection.addIceCandidate(data.candidate).catch(() => {});
      } else {
        peer.pendingCandidates.push(data.candidate);
      }
    }
  }

  function remove(peerId) {
    const peer = connections.get(peerId);
    if (!peer) return;
    peer.connection.close();
    connections.delete(peerId);
    config.onPeerLeft(peerId);
  }

  // Used when switching between the camera and a shared screen.
  async function replaceVideoTrack(track) {
    for (const peer of connections.values()) {
      const sender = peer.connection.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(track);
    }
  }

  function broadcast(message) {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    for (const peer of connections.values()) {
      if (peer.channel && peer.channel.readyState === 'open') peer.channel.send(payload);
    }
  }

  function channelFor(peerId) {
    const peer = connections.get(peerId);
    return peer && peer.channel && peer.channel.readyState === 'open' ? peer.channel : null;
  }

  function openChannels() {
    return [...connections.keys()].map(channelFor).filter(Boolean);
  }

  return {
    init, create, handleSignal, remove, replaceVideoTrack,
    broadcast, channelFor, openChannels, get, names,
  };
})();
