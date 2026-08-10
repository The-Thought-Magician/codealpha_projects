// A shared sketch pad. Strokes travel over the peer data channels, so the
// drawing never reaches the server.
const Whiteboard = (() => {
  const COLOURS = ['#e8ecf1', '#ffd166', '#7ee0b8', '#ff8fa3', '#8ab6ff'];

  let canvas = null;
  let ctx = null;
  let drawing = false;
  let last = null;
  let colour = COLOURS[0];
  let width = 3;
  const history = [];

  function init(canvasEl, paletteEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('pointerdown', begin);
    canvas.addEventListener('pointermove', extend);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointerleave', end);

    paletteEl.innerHTML = COLOURS
      .map((c, i) => `<button class="swatch ${i === 0 ? 'on' : ''}" style="--swatch:${c}" data-colour="${c}"></button>`)
      .join('');
    paletteEl.addEventListener('click', (event) => {
      const button = event.target.closest('[data-colour]');
      if (!button) return;
      colour = button.dataset.colour;
      paletteEl.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s === button));
    });
  }

  // Coordinates travel as fractions of the canvas, so a stroke lands in the
  // same place on a differently sized window.
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  function begin(event) {
    canvas.setPointerCapture(event.pointerId);
    drawing = true;
    last = point(event);
  }

  function extend(event) {
    if (!drawing) return;
    const next = point(event);
    const stroke = { from: last, to: next, colour, width };
    paint(stroke);
    history.push(stroke);
    Peers.broadcast({ kind: 'stroke', stroke });
    last = next;
  }

  function end() {
    drawing = false;
    last = null;
  }

  function paint({ from, to, colour: strokeColour, width: strokeWidth }) {
    ctx.strokeStyle = strokeColour;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
    ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
    ctx.stroke();
  }

  function receive(stroke) {
    history.push(stroke);
    paint(stroke);
  }

  function clear(broadcast = true) {
    history.length = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (broadcast) Peers.broadcast({ kind: 'board-clear' });
  }

  // Newcomers ask for the board; whoever is holding strokes replies with them.
  function snapshot() {
    return history.slice();
  }

  function restore(strokes) {
    if (!strokes.length || history.length) return;
    strokes.forEach(receive);
  }

  // The board starts inside a hidden panel, where clientWidth is 0, so this
  // has to run again once the panel is actually on screen.
  function resize() {
    if (!canvas || !canvas.clientWidth) return;
    const saved = history.slice();
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saved.forEach(paint);
  }

  return { init, receive, clear, snapshot, restore, resize };
})();
