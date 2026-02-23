// ======= CONFIG RÁPIDA =======
const HORA = "12:00";
const REVEAL_AFTER_SCRATCH_UNITS = 220; // cuanto hay que rascar para “completar”
const BRUSH = 34; // grosor del rasca
// =============================

const canvas = document.getElementById("scratch");
const ctx = canvas.getContext("2d", { willReadFrequently: false });
const hint = document.getElementById("hint");
const resetBtn = document.getElementById("resetBtn");
document.getElementById("hora").textContent = `Hora: ${HORA}`;

let isDown = false;
let last = null;
let revealed = false;
let scratchUnits = 0; // contador ligero

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function rect() {
  return canvas.getBoundingClientRect();
}

// Ajuste nítido en móvil/retina
function fitCanvas() {
  const r = rect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // trabajamos en px CSS
}

function heartPath(w, h) {
  const cx = w * 0.5;
  const cy = h * 0.46;
  const size = Math.min(w, h) * 0.30;

  const p = new Path2D();
  p.moveTo(cx, cy + size * 0.35);
  p.bezierCurveTo(cx + size, cy - size * 0.2, cx + size * 0.75, cy - size * 1.05, cx, cy - size * 0.55);
  p.bezierCurveTo(cx - size * 0.75, cy - size * 1.05, cx - size, cy - size * 0.2, cx, cy + size * 0.35);
  p.closePath();
  return p;
}

let hp = null; // cache de la ruta del corazón (clave para rendimiento)

function redrawOverlay() {
  const r = rect();
  const w = r.width;
  const h = r.height;

  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w, h);

  // Overlay dorado
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, cssVar("--gold1", "#f6e6b6"));
  g.addColorStop(0.5, cssVar("--gold2", "#e8c97a"));
  g.addColorStop(1, cssVar("--gold3", "#caa24d"));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // speckles
  ctx.globalAlpha = 0.20;
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rr = Math.random() * 1.6 + 0.4;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Cachea corazón
  hp = heartPath(w, h);

  // oscurece fuera del corazón (guía visual)
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fill(hp);
  ctx.restore();

  // borde
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.stroke(hp);
  ctx.restore();
}

function getPos(e) {
  const r = rect();
  const p = e.touches ? e.touches[0] : e;
  return { x: p.clientX - r.left, y: p.clientY - r.top };
}

function inHeart(p) {
  // MUY rápido porque hp está cacheado
  return ctx.isPointInPath(hp, p.x, p.y);
}

function scratchStroke(a, b) {
  if (!inHeart(b)) return;

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = BRUSH;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();

  // suma unidades según distancia (barato)
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  scratchUnits += Math.sqrt(dx * dx + dy * dy) / 6; // factor ajustable
}

function scratchDot(p) {
  if (!inHeart(p)) return;

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(p.x, p.y, BRUSH * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  scratchUnits += 10;
}

function maybeFinish() {
  if (revealed) return;

  // Oculta hint temprano para que no moleste
  if (scratchUnits > 40) hint.style.opacity = "0";

  if (scratchUnits >= REVEAL_AFTER_SCRATCH_UNITS) {
    revealed = true;
    hint.style.opacity = "0";
    burstHearts();
  }
}

function start(e) {
  e.preventDefault();
  isDown = true;
  const p = getPos(e);
  last = p;
  scratchDot(p);
  maybeFinish();
}

function move(e) {
  if (!isDown) return;
  e.preventDefault();
  const p = getPos(e);

  // IMPORTANTE: limitamos la frecuencia de dibujo a requestAnimationFrame
  // para que sea suave en móvil
  requestAnimationFrame(() => {
    if (!isDown || !last) return;
    scratchStroke(last, p);
    last = p;
    maybeFinish();
  });
}

function end() {
  isDown = false;
  last = null;
}

function reset() {
  scratchUnits = 0;
  revealed = false;

  fitCanvas();
  redrawOverlay();

  hint.style.opacity = "1";
  hint.textContent = "Rasca el corazón dorado para descubrir la hora";
}

function burstHearts() {
  const container = document.querySelector(".scratch-area");
  const count = 14;

  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    s.textContent = Math.random() > 0.35 ? "💗" : "✨";
    s.style.position = "absolute";
    s.style.left = `${40 + Math.random() * 20}%`;
    s.style.top = `${52 + Math.random() * 10}%`;
    s.style.fontSize = `${14 + Math.random() * 16}px`;
    s.style.opacity = "0";
    s.style.transform = `translate(-50%,-50%) translate(${(Math.random()-0.5)*40}px, ${(Math.random()-0.5)*20}px)`;
    s.style.transition = `all ${900 + Math.random()*600}ms ease-out`;

    container.appendChild(s);

    requestAnimationFrame(() => {
      s.style.opacity = "1";
      s.style.transform = `translate(-50%,-50%) translate(${(Math.random()-0.5)*140}px, ${-120 - Math.random()*120}px)`;
    });

    setTimeout(() => { s.style.opacity = "0"; }, 900);
    setTimeout(() => { s.remove(); }, 1600);
  }
}

// Eventos mouse
canvas.addEventListener("mousedown", start);
canvas.addEventListener("mousemove", move);
window.addEventListener("mouseup", end);

// Eventos touch (iOS)
canvas.addEventListener("touchstart", start, { passive: false });
canvas.addEventListener("touchmove", move, { passive: false });
canvas.addEventListener("touchend", end, { passive: true });

resetBtn.addEventListener("click", reset);
window.addEventListener("resize", reset);

// Init
reset();