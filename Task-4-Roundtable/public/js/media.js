// Owns the local camera and microphone, and the swap to a shared screen.
const Media = (() => {
  let stream = null;
  let cameraTrack = null;
  let screenTrack = null;

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    cameraTrack = stream.getVideoTracks()[0];
    return stream;
  }

  function localStream() {
    return stream;
  }

  function toggleAudio() {
    const track = stream.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  function toggleVideo() {
    const track = stream.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  function sharingScreen() {
    return Boolean(screenTrack);
  }

  // Swaps the outgoing video track on every peer connection, so the other side
  // does not have to renegotiate. Stopping the share from the browser's own
  // control bar puts the camera back.
  async function startScreenShare(onEnded) {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
    screenTrack = display.getVideoTracks()[0];

    await Peers.replaceVideoTrack(screenTrack);
    screenTrack.addEventListener('ended', () => stopScreenShare().then(onEnded));
    return screenTrack;
  }

  async function stopScreenShare() {
    if (!screenTrack) return cameraTrack;
    screenTrack.stop();
    screenTrack = null;
    await Peers.replaceVideoTrack(cameraTrack);
    return cameraTrack;
  }

  function stop() {
    if (screenTrack) screenTrack.stop();
    if (stream) stream.getTracks().forEach((track) => track.stop());
  }

  return {
    start, localStream, toggleAudio, toggleVideo,
    startScreenShare, stopScreenShare, sharingScreen, stop,
  };
})();
