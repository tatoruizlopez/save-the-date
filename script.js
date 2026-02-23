// ======= CONFIG =======
const HORA = "12:00";
const BRUSH = 38;               // grosor del rasca
const CELEBRATE_AFTER = 220;    // umbral para lanzar confetti (pero NO bloquea seguir rascando)
// ======================

const canvas = document.getElementById("scratch");
const ctx = canvas.getContext("2d");
const hint = document.getElementById("hint");
const resetBtn = document.getElementById("resetBtn");
document.getElementById("hora").textContent = HORA;

let hp = null;                  // Path2D corazón cacheado
let drawing = false;
let last = null;
let scratchUnits = 0;
let celebrated = false;
let activePointerId = null;

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function getRect() {
  return canvas.getBoundingClientRect();
}

function fitCanvas() {
  const r = getRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);

  // Dibujar en coordenadas CSS
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function buildHeartPath(w, h) {
  const cx = w * 0.5;
  const cy = h * 0.46;                 // coincide con CSS top:46%
  const size = Math.min(w, h) * 0.30;  // tamaño del corazón

  const p = new Path2D();
  p.moveTo(cx, cy + size * 0.35);
  p.bezierCurveTo(cx + size, cy - size * 0.2, cx + size * 0.75, cy - size * 1.05, cx, cy - size * 0.55);
  p.bezierCurveTo(cx - size * 0.75, cy - size * 1.05, cx - size, cy - size * 0.2, cx, cy + size * 0.35);
  p.closePath();
  return p;
}

function drawGoldHeartOverlay() {
  const r = getRect();
  const w = r.width;
  const h = r.height;

  ctx.clearRect(0, 0, w, h);

  hp = buildHeartPath(w, h);

  // Dibuja dorado SOLO dentro del corazón (fuera = transparente)
  ctx.save();
  ctx.clip(hp);

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, cssVar("--gold1", "#f6e6b6"));
  g.addColorStop(0.5, cssVar("--gold2", "#e8c97a"));
  g.addColorStop(1, cssVar("--gold3", "#caa24d"));

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Textura foil suave
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 130; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rr = Math.random() * 1.7 + 0.4;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // Borde del corazón
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.stroke(hp);
  ctx.restore();
}

function posFromEvent(e) {
  const r = getRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function scratchStroke(a, b) {
  // IMPORTANTE: NO BLOQUEAMOS nunca. Siempre se puede seguir rascando.
  ctx.save();
  ctx.clip(hp);
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = BRUSH;

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  scratchUnits += Math.sqrt(dx * dx + dy * dy) / 6;
}

function scratchDot(p) {
  ctx.save();
  ctx.clip(hp);
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(p.x, p.y, BRUSH * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  scratchUnits += 10;
}

function maybeCelebrate() {
  // Oculta hint pronto
  if (scratchUnits > 40) hint.style.opacity = "0";

  // Lanza confetti una vez, pero deja seguir rascando siempre
  if (!celebrated && scratchUnits >= CELEBRATE_AFTER) {
    celebrated = true;
    hint.style.opacity = "0";
    burstHearts();
  }
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

function reset() {
  drawing = false;
  last = null;
  scratchUnits = 0;
  celebrated = false;

  hint.style.opacity = "1";
  hint.textContent = "Rasca el corazón dorado para descubrir la hora";

  fitCanvas();
  drawGoldHeartOverlay();
}

// ===== Pointer Events =====
function onPointerDown(e) {
  if (activePointerId !== null) return;

  activePointerId = e.pointerId;
  canvas.setPointerCapture(activePointerId);

  drawing = true;
  const p = posFromEvent(e);
  last = p;

  scratchDot(p);
  maybeCelebrate();
}

let rafPending = false;
let pendingPoint = null;

function onPointerMove(e) {
  if (!drawing || e.pointerId !== activePointerId) return;

  pendingPoint = posFromEvent(e);
  if (rafPending) return;

  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    if (!drawing || !last || !pendingPoint) return;

    scratchStroke(last, pendingPoint);
    last = pendingPoint;
    pendingPoint = null;
    maybeCelebrate();
  });
}

function onPointerUp(e) {
  if (e.pointerId !== activePointerId) return;

  drawing = false;
  last = null;

  try { canvas.releasePointerCapture(activePointerId); } catch {}
  activePointerId = null;
}

canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);

resetBtn.addEventListener("click", reset);
window.addEventListener("resize", reset);

// Init
reset();