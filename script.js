// ======= CONFIG =======
const HORA = "12:00";
const BRUSH = 32;
const CELEBRATE_AFTER = 220;

const TEXT_STEP1 = "Pulsa aquí, somos Cris, Elián y Jose.";
const TEXT_STEP2 = "Tenemos que compartir contigo una cosa…";
// ======================

// Intro
const intro = document.getElementById("intro");
const flash = document.getElementById("flash");

const introMsg1 = document.getElementById("introMsg1");
const introMsg2 = document.getElementById("introMsg2");
const introTap = document.getElementById("introTap");

const type1 = document.getElementById("type1");
const type2 = document.getElementById("type2");
const caret1 = document.getElementById("caret1");
const caret2 = document.getElementById("caret2");

let introStep = 0; // 0->toca para arrancar música + paso2, 1->toca para flash + whoosh + entrar

// Main
const stage = document.getElementById("heartStage");
const reveal = document.getElementById("heartReveal");
const canvas = document.getElementById("scratch");
const ctx = canvas.getContext("2d");
const hint = document.getElementById("hint");
const resetBtn = document.getElementById("resetBtn");
const musicBtn = document.getElementById("musicBtn");
const musicStatus = document.getElementById("musicStatus");

// Audio
const bgm = document.getElementById("bgm");
const whoosh = document.getElementById("whoosh");

document.getElementById("hora").textContent = HORA;

// Scratch state
let hp = null;
let drawing = false;
let last = null;
let scratchUnits = 0;
let celebrated = false;

let activePointerId = null;
let touchActive = false;

let rafPending = false;
let pendingPoint = null;

// Music state
let statusTimer = null;
let audioStarted = false;

function setStatus(msg) {
  if (!musicStatus) return;
  clearTimeout(statusTimer);

  if (!msg) {
    musicStatus.classList.remove("show");
    musicStatus.textContent = "";
    return;
  }

  musicStatus.textContent = msg;
  musicStatus.classList.add("show");
  statusTimer = setTimeout(() => {
    musicStatus.classList.remove("show");
    musicStatus.textContent = "";
  }, 4500);
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/* =========================
   TYPEWRITER
   ========================= */
function typewriter(el, caretEl, text, speed = 26) {
  if (!el) return Promise.resolve();

  el.textContent = "";
  if (caretEl) caretEl.style.display = "inline-block";

  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      el.textContent = text.slice(0, i);
      i++;
      if (i <= text.length) {
        setTimeout(tick, speed);
      } else {
        // deja el caret un instante y luego lo apaga (más limpio)
        setTimeout(() => {
          if (caretEl) caretEl.style.display = "none";
          resolve();
        }, 650);
      }
    };
    tick();
  });
}

/* =========================
   AUDIO
   ========================= */
function updateMusicBtn() {
  if (!bgm || !musicBtn) return;
  musicBtn.textContent = bgm.paused ? "🎵 Música" : "🔊 Música";
}

function fadeVolume(to = 0.85, ms = 650) {
  const from = bgm.volume ?? 0;
  const start = performance.now();
  function step(t) {
    const k = Math.min(1, (t - start) / ms);
    bgm.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

async function startMusicFromGesture() {
  if (!bgm || audioStarted) return;

  audioStarted = true;
  bgm.volume = 0.0;

  try { bgm.load(); } catch {}
  try {
    await bgm.play();
    fadeVolume(0.85, 650);
  } catch {
    setStatus("El navegador bloqueó el audio. Revisa: sitio no silenciado / permiso de sonido.");
    audioStarted = false;
  }
  updateMusicBtn();
}

async function playWhoosh() {
  if (!whoosh) return;

  // si no existe el archivo, no rompe: simplemente no sonará
  // (en ese caso el evento 'error' saltará)
  try {
    whoosh.currentTime = 0;
    whoosh.volume = 0.9;
    await whoosh.play();
  } catch {
    // ignore
  }
}

/* =========================
   SCRATCH
   ========================= */
function getRect() {
  return stage.getBoundingClientRect();
}

function fitCanvas() {
  const r = getRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function buildHeartPath(w, h) {
  const cx = w * 0.5;
  const cy = h * 0.55;
  const size = Math.min(w, h) * 0.58;

  const p = new Path2D();
  p.moveTo(cx, cy + size * 0.35);
  p.bezierCurveTo(cx + size, cy - size * 0.2, cx + size * 0.75, cy - size * 1.05, cx, cy - size * 0.55);
  p.bezierCurveTo(cx - size * 0.75, cy - size * 1.05, cx - size, cy - size * 0.2, cx, cy + size * 0.35);
  p.closePath();
  return p;
}

function hideReveal() { if (reveal) reveal.style.opacity = "0"; }
function showReveal() { if (reveal) reveal.style.opacity = "1"; }

function drawGoldHeartOverlay() {
  hideReveal();

  const r = getRect();
  const w = r.width;
  const h = r.height;

  ctx.clearRect(0, 0, w, h);
  hp = buildHeartPath(w, h);

  ctx.save();
  ctx.clip(hp);

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, cssVar("--gold1", "#f6e6b6"));
  g.addColorStop(0.5, cssVar("--gold2", "#e8c97a"));
  g.addColorStop(1, cssVar("--gold3", "#caa24d"));

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 120; i++) {
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

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.stroke(hp);
  ctx.restore();

  showReveal();
}

function posFromClient(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: clientX - r.left, y: clientY - r.top };
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

function scratchStroke(a, b) {
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

function maybeCelebrate() {
  if (scratchUnits > 25) hint.style.opacity = "0";
  if (!celebrated && scratchUnits >= CELEBRATE_AFTER) {
    celebrated = true;
    hint.style.opacity = "0";
    burstHearts();
  }
}

function burstHearts() {
  const container = stage;
  const count = 12;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    s.textContent = Math.random() > 0.35 ? "💗" : "✨";
    s.style.position = "absolute";
    s.style.left = `${45 + Math.random() * 10}%`;
    s.style.top = `${55 + Math.random() * 10}%`;
    s.style.fontSize = `${14 + Math.random() * 16}px`;
    s.style.opacity = "0";
    s.style.transform = `translate(-50%,-50%) translate(${(Math.random()-0.5)*30}px, ${(Math.random()-0.5)*20}px)`;
    s.style.transition = `all ${850 + Math.random()*650}ms ease-out`;
    s.style.pointerEvents = "none";

    container.appendChild(s);
    requestAnimationFrame(() => {
      s.style.opacity = "1";
      s.style.transform = `translate(-50%,-50%) translate(${(Math.random()-0.5)*120}px, ${-90 - Math.random()*120}px)`;
    });

    setTimeout(() => { s.style.opacity = "0"; }, 850);
    setTimeout(() => { s.remove(); }, 1500);
  }
}

function scheduleMove(p) {
  pendingPoint = p;
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

function startAt(p) {
  drawing = true;
  last = p;
  scratchDot(p);
  maybeCelebrate();
}

function endDraw() {
  drawing = false;
  last = null;
  pendingPoint = null;
  rafPending = false;
}

// Input events
function onPointerDown(e) {
  if (touchActive) return;
  if (activePointerId !== null) return;

  activePointerId = e.pointerId;
  try { canvas.setPointerCapture(activePointerId); } catch {}
  startAt(posFromClient(e.clientX, e.clientY));
}

function onPointerMove(e) {
  if (touchActive) return;
  if (!drawing || e.pointerId !== activePointerId) return;
  scheduleMove(posFromClient(e.clientX, e.clientY));
}

function onPointerUp(e) {
  if (touchActive) return;
  if (e.pointerId !== activePointerId) return;
  try { canvas.releasePointerCapture(activePointerId); } catch {}
  activePointerId = null;
  endDraw();
}

function onTouchStart(e) {
  touchActive = true;
  e.preventDefault();
  const t = e.touches[0];
  if (!t) return;
  startAt(posFromClient(t.clientX, t.clientY));
}

function onTouchMove(e) {
  if (!touchActive || !drawing) return;
  e.preventDefault();
  const t = e.touches[0];
  if (!t) return;
  scheduleMove(posFromClient(t.clientX, t.clientY));
}

function onTouchEnd(e) {
  e.preventDefault();
  touchActive = false;
  endDraw();
}

function resetScratch() {
  touchActive = false;
  activePointerId = null;
  scratchUnits = 0;
  celebrated = false;

  hint.style.opacity = "1";
  hint.textContent = "Rasca el corazón dorado para descubrir la hora";

  fitCanvas();
  drawGoldHeartOverlay();
  updateMusicBtn();
  setStatus("");
}

/* =========================
   INTRO FLOW
   ========================= */
async function toStep0Initial() {
  // Arranque: typewriter del texto 1
  introMsg1.classList.add("show");
  await typewriter(type1, caret1, TEXT_STEP1, 22);
}

async function toStep1() {
  // Primer toque: música + cambia texto 2 con typewriter + muestra “Toca la pantalla”
  await startMusicFromGesture();

  introMsg1.classList.remove("show");
  introMsg2.classList.add("show");
  introTap.classList.add("show");

  await typewriter(type2, caret2, TEXT_STEP2, 22);

  introStep = 1;
}

async function toStep2() {
  // Segundo toque: flash + whoosh + salir
  if (flash) {
    flash.classList.remove("on");
    // reflow
    void flash.offsetWidth;
    flash.classList.add("on");
  }

  await playWhoosh();

  intro.classList.add("intro-dismiss");
  setTimeout(() => { intro.style.display = "none"; }, 520);
}

function onIntroTap(e) {
  e.preventDefault();
  if (introStep === 0) toStep1();
  else toStep2();
}

/* =========================
   SETUP
   ========================= */
function setup() {
  // Pre-dibuja rasca detrás de la intro (para entrar instantáneo)
  requestAnimationFrame(() => resetScratch());

  // Bind intro
  intro.addEventListener("click", onIntroTap);
  intro.addEventListener("touchend", onIntroTap, { passive: false });
  intro.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") onIntroTap(e);
  });

  // Scratch events
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

  resetBtn.addEventListener("click", resetScratch);
  window.addEventListener("resize", resetScratch);

  musicBtn.addEventListener("click", async () => {
    if (!bgm) return;
    if (bgm.paused) {
      audioStarted = false;
      await startMusicFromGesture();
    } else {
      bgm.pause();
      updateMusicBtn();
    }
  });

  // Arranca el mensaje 1 animado sin toque
  toStep0Initial();
  updateMusicBtn();
}

setup();