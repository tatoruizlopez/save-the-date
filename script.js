// ======= CONFIG RÁPIDA =======
const HORA = "12:00"; // Hora de la boda
// =============================

const canvas = document.getElementById("scratch");
const ctx = canvas.getContext("2d");
const hint = document.getElementById("hint");
const resetBtn = document.getElementById("resetBtn");
document.getElementById("hora").textContent = `Hora: ${HORA}`;

let isDrawing = false;
let last = null;
let revealed = false;

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function getRect() {
  return canvas.getBoundingClientRect();
}

function fitCanvas() {
  // Canvas a tamaño CSS * DPR para que se vea nítido
  const rect = getRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  // Trabajaremos en coordenadas CSS (no DPR)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function heartPath(w, h) {
  // corazón centrado (zona rascable)
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

function drawGoldOverlay() {
  const rect = getRect();
  const w = rect.width;
  const h = rect.height;

  // Limpia
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w, h);

  // Degradado dorado (capa completa)
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, cssVar("--gold1", "#f6e6b6"));
  g.addColorStop(0.5, cssVar("--gold2", "#e8c97a"));
  g.addColorStop(1, cssVar("--gold3", "#caa24d"));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // “Foil” speckles sutiles
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 1.7 + 0.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Oscurece ligeramente fuera del corazón para guiar el rasca (más pro)
  const hp = heartPath(w, h);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fill(hp); // “recorta” el sombreado dejando claro el corazón
  ctx.restore();

  // Borde blanco del corazón
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.stroke(hp);
  ctx.restore();
}

function getPointerPos(e) {
  const rect = getRect();
  const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
  return { x: p.clientX - rect.left, y: p.clientY - rect.top };
}

function pointInsideHeart(p) {
  const rect = getRect();
  const hp = heartPath(rect.width, rect.height);
  return ctx.isPointInPath(hp, p.x, p.y);
}

function scratch(from, to) {
  // Rasca SOLO si estamos dentro del corazón
  if (!pointInsideHeart(to)) return;

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function scratchDot(p) {
  if (!pointInsideHeart(p)) return;

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function scratchedPercentInHeart() {
  // Calcula % rascado SOLO dentro del corazón
  const rect = getRect();
  const w = Math.floor(rect.width);
  const h = Math.floor(rect.height);

  const img = ctx.getImageData(0, 0, w, h);
  const hp = heartPath(w, h);

  let total = 0;
  let transparent = 0;

  // Muestreo por pasos para acelerar (2 = bastante preciso sin ir lento)
  const step = 2;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (!ctx.isPointInPath(hp, x, y)) continue;
      total++;

      const idx = (y * w + x) * 4 + 3; // alpha
      if (img.data[idx] === 0) transparent++;
    }
  }

  if (total === 0) return 0;
  return transparent / total;
}

function maybeReveal() {
  const p = scratchedPercentInHeart();

  if (p > 0.18) hint.style.opacity = "0";
  else hint.style.opacity = "1";

  // Al 55%: “final effect”
  if (!revealed && p > 0.55) {
    revealed = true;
    hint.textContent = "¡Ya está! 💗";
    hint.style.opacity = "0";
    burstHearts();
  }
}

function start(e) {
  e.preventDefault();
  isDrawing = true;
  const p = getPointerPos(e);
  last = p;
  scratchDot(p);
  maybeReveal();
}

function move(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const p = getPointerPos(e);
  scratch(last, p);
  last = p;
  maybeReveal();
}

function end() {
  isDrawing = false;
  last = null;
}

function reset() {
  revealed = false;
  fitCanvas();
  drawGoldOverlay();
  hint.style.opacity = "1";
  hint.textContent = "Rasca el corazón dorado para descubrir la hora";
}

function burstHearts() {
  // Confetti suave de corazoncitos usando elementos flotantes
  const container = document.querySelector(".scratch-area");
  const rect = container.getBoundingClientRect();

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

    // trigger anim
    requestAnimationFrame(() => {
      s.style.opacity = "1";
      s.style.transform = `translate(-50%,-50%) translate(${(Math.random()-0.5)*140}px, ${-120 - Math.random()*120}px)`;
    });

    // cleanup
    setTimeout(() => {
      s.style.opacity = "0";
    }, 900);

    setTimeout(() => {
      s.remove();
    }, 1600);
  }
}

// Eventos
canvas.addEventListener("mousedown", start);
canvas.addEventListener("mousemove", move);
window.addEventListener("mouseup", end);

canvas.addEventListener("touchstart", start, { passive: false });
canvas.addEventListener("touchmove", move, { passive: false });
canvas.addEventListener("touchend", end);

resetBtn.addEventListener("click", reset);
window.addEventListener("resize", reset);

// Init
reset();