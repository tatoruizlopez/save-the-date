// ======= CONFIG =======
const HORA = "12:00";
const BRUSH = 32;
const CELEBRATE_AFTER = 220;

const TEXT_STEP1 = "Pulsa aquí, somos Cris, Elián y Jose.";
const TEXT_STEP2 = "Tenemos que compartir contigo una cosa…";

// SUPER GLITTER
const GLITTER_DUST = 1100;
const GLITTER_TWINKLES = 44;
const SPARKLES_ON_SCRATCH = 2;

// SHINNY (más exagerado)
const SHINE_PERIOD_MS = 820;        // ✅ más rápido
const SHINE_TWINKLES = 22;          // ✅ más twinkles animados
const SHINE_BLING_EVERY_MS = 2200;  // ✅ bling extra cada X ms
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

let introStep = 0;

// Main
const stage = document.getElementById("heartStage");
const reveal = document.getElementById("heartReveal");

const canvas = document.getElementById("scratch");
const ctx = canvas.getContext("2d");

const shineCanvas = document.getElementById("shine");
const shineCtx = shineCanvas.getContext("2d");

const outlineCanvas = document.getElementById("outline");
const outlineCtx = outlineCanvas.getContext("2d");

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

// Sparkles (DOM)
let sparkleBudget = 0;

// Music state
let statusTimer = null;
let audioStarted = false;

// Shine state
let shineActive = false;
let shineRAF = null;
let shineTwinkles = [];
let lastShineTs = 0;
let lastBlingTs = 0;

// Outline state
let outlineOn = false;

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

/* TYPEWRITER */
function typewriter(el, caretEl, text, speed = 26) {
  if (!el) return Promise.resolve();
  el.textContent = "";
  if (caretEl) caretEl.style.display = "inline-block";

  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      el.textContent = text.slice(0, i);
      i++;
      if (i <= text.length) setTimeout(tick, speed);
      else setTimeout(() => {
        if (caretEl) caretEl.style.display = "none";
        resolve();
      }, 650);
    };
    tick();
  });
}

/* AUDIO */
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
  try {
    whoosh.currentTime = 0;
    whoosh.volume = 0.9;
    await whoosh.play();
  } catch {}
}

/* SPARKLES (DOM) */
function spawnSparkle(x, y, scale = 1) {
  if (sparkleBudget > 18) return;
  sparkleBudget++;

  const s = document.createElement("span");
  s.textContent = Math.random() > 0.55 ? "✨" : "✦";
  s.style.position = "absolute";
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  s.style.transform = `translate(-50%, -50%) scale(${0.8 * scale})`;
  s.style.opacity = "0";
  s.style.pointerEvents = "none";
  s.style.filter = "drop-shadow(0 6px 10px rgba(255,255,255,0.35))";
  s.style.transition = `all ${600 + Math.random()*450}ms ease-out`;

  stage.appendChild(s);

  const dx = (Math.random() - 0.5) * 140;
  const dy = -70 - Math.random() * 120;
  const rot = (Math.random() - 0.5) * 80;

  requestAnimationFrame(() => {
    s.style.opacity = "1";
    s.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${1.1 * scale})`;
  });

  setTimeout(() => { s.style.opacity = "0"; }, 420);
  setTimeout(() => {
    s.remove();
    sparkleBudget = Math.max(0, sparkleBudget - 1);
  }, 900);
}

function sparkleBurst(centerX, centerY, count = 18) {
  for (let i = 0; i < count; i++) {
    spawnSparkle(centerX + (Math.random()-0.5)*20, centerY + (Math.random()-0.5)*20, 1 + Math.random()*0.5);
  }
}

/* CANVAS SIZING + HEART PATH */
function getRect() { return stage.getBoundingClientRect(); }

function fitCanvasAll() {
  const r = getRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  shineCanvas.width = Math.round(r.width * dpr);
  shineCanvas.height = Math.round(r.height * dpr);
  shineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  outlineCanvas.width = Math.round(r.width * dpr);
  outlineCanvas.height = Math.round(r.height * dpr);
  outlineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

function drawTwinkleOn(ctx2d, x, y, r, alpha) {
  ctx2d.save();
  ctx2d.globalAlpha = alpha;
  ctx2d.lineWidth = Math.max(1, r * 0.35);
  ctx2d.strokeStyle = "rgba(255,255,255,0.98)";
  ctx2d.beginPath();
  ctx2d.moveTo(x - r, y);
  ctx2d.lineTo(x + r, y);
  ctx2d.moveTo(x, y - r);
  ctx2d.lineTo(x, y + r);
  ctx2d.stroke();

  ctx2d.globalAlpha = alpha * 0.7;
  ctx2d.beginPath();
  ctx2d.moveTo(x - r * 0.75, y - r * 0.75);
  ctx2d.lineTo(x + r * 0.75, y + r * 0.75);
  ctx2d.moveTo(x - r * 0.75, y + r * 0.75);
  ctx2d.lineTo(x + r * 0.75, y - r * 0.75);
  ctx2d.stroke();
  ctx2d.restore();
}

/* GOLD HEART DRAW */
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

  // foil stripes
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.translate(w * 0.12, -h * 0.08);
  ctx.rotate(-Math.PI / 8);
  for (let i = -h; i < w + h; i += 14) {
    const grad = ctx.createLinearGradient(i, 0, i + 11, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.95)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(i, 0, 11, h * 1.7);
  }
  ctx.restore();

  // dust
  ctx.save();
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < GLITTER_DUST; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rr = Math.random() * 1.35 + 0.20;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    const bright = Math.random();
    ctx.fillStyle =
      bright > 0.82 ? "rgba(255,255,255,0.98)" :
      bright > 0.55 ? "rgba(255,255,255,0.70)" :
                      "rgba(255,255,255,0.35)";
    ctx.fill();
  }
  ctx.restore();

  // static twinkles
  for (let i = 0; i < GLITTER_TWINKLES; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rr = Math.random() * 8 + 6;
    const a = Math.random() * 0.45 + 0.25;
    drawTwinkleOn(ctx, x, y, rr, a);
  }

  // bokeh
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rr = Math.random() * 22 + 10;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rr);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore(); // clip

  // border
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.stroke(hp);
  ctx.restore();

  showReveal();
}

/* OUTLINE FINAL */
function drawOutline() {
  const r = getRect();
  const w = r.width;
  const h = r.height;

  outlineCtx.clearRect(0, 0, w, h);

  // brillo dorado gordito
  const grad = outlineCtx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, cssVar("--gold1", "#f6e6b6"));
  grad.addColorStop(0.5, cssVar("--gold2", "#e8c97a"));
  grad.addColorStop(1, cssVar("--gold3", "#caa24d"));

  outlineCtx.save();
  outlineCtx.strokeStyle = grad;
  outlineCtx.lineWidth = 10; // ✅ gordito
  outlineCtx.lineJoin = "round";
  outlineCtx.lineCap = "round";
  outlineCtx.shadowColor = "rgba(255,255,255,0.85)";
  outlineCtx.shadowBlur = 10;

  outlineCtx.stroke(hp);
  outlineCtx.restore();

  outlineCanvas.classList.add("on");
  outlineOn = true;
}

/* SHINNY */
function initShineTwinkles(w, h) {
  shineTwinkles = [];
  let attempts = 0;

  while (shineTwinkles.length < SHINE_TWINKLES && attempts < 1200) {
    attempts++;
    const x = Math.random() * w;
    const y = Math.random() * h;
    if (!shineCtx.isPointInPath(hp, x, y)) continue;

    shineTwinkles.push({
      x, y,
      r: 7 + Math.random() * 12,
      speed: 0.9 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2
    });
  }
}

function startShine() {
  if (shineActive) return;
  if (!hp) return;

  shineActive = true;
  shineCanvas.classList.remove("off");

  const r = getRect();
  initShineTwinkles(r.width, r.height);

  lastShineTs = 0;
  lastBlingTs = 0;

  const loop = (ts) => {
    if (!shineActive) return;

    if (lastShineTs && ts - lastShineTs < 28) {
      shineRAF = requestAnimationFrame(loop);
      return;
    }
    lastShineTs = ts;

    const w = r.width;
    const h = r.height;

    shineCtx.clearRect(0, 0, w, h);
    shineCtx.save();
    shineCtx.clip(hp);

    // sweep más intenso + rápido
    const prog = (ts % SHINE_PERIOD_MS) / SHINE_PERIOD_MS;
    const x0 = -w + (w * 2.4) * prog;
    const x1 = x0 + w * 1.05;

    const sweep = shineCtx.createLinearGradient(x0, 0, x1, h);
    sweep.addColorStop(0.0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.46, "rgba(255,255,255,0)");
    sweep.addColorStop(0.52, "rgba(255,255,255,0.92)");
    sweep.addColorStop(0.58, "rgba(255,255,255,0)");
    sweep.addColorStop(1.0, "rgba(255,255,255,0)");

    shineCtx.globalAlpha = 0.78;
    shineCtx.fillStyle = sweep;
    shineCtx.fillRect(0, 0, w, h);

    // glow blob fuerte
    shineCtx.globalAlpha = 0.22;
    const gx = w * (0.20 + 0.60 * prog);
    const gy = h * 0.32;
    const gr = Math.min(w, h) * 0.32;
    const blob = shineCtx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    blob.addColorStop(0, "rgba(255,255,255,0.95)");
    blob.addColorStop(1, "rgba(255,255,255,0)");
    shineCtx.fillStyle = blob;
    shineCtx.beginPath();
    shineCtx.arc(gx, gy, gr, 0, Math.PI * 2);
    shineCtx.fill();

    // twinkles animados
    for (const t of shineTwinkles) {
      const a = Math.max(0, Math.sin(ts / 1000 * t.speed + t.phase));
      const alpha = 0.12 + Math.pow(a, 3) * 0.65;
      drawTwinkleOn(shineCtx, t.x, t.y, t.r, alpha);
    }

    // BLING extra cada X ms
    if (ts - lastBlingTs > SHINE_BLING_EVERY_MS) {
      lastBlingTs = ts;

      // un destello grande y 2-3 twinkles muy fuertes
      shineCtx.globalAlpha = 0.95;
      const bx = w * (0.25 + Math.random() * 0.50);
      const by = h * (0.28 + Math.random() * 0.48);
      const br = Math.min(w, h) * 0.18;
      const bl = shineCtx.createRadialGradient(bx, by, 0, bx, by, br);
      bl.addColorStop(0, "rgba(255,255,255,1)");
      bl.addColorStop(1, "rgba(255,255,255,0)");
      shineCtx.fillStyle = bl;
      shineCtx.beginPath();
      shineCtx.arc(bx, by, br, 0, Math.PI * 2);
      shineCtx.fill();

      for (let i = 0; i < 3; i++) {
        const tx = bx + (Math.random()-0.5) * 70;
        const ty = by + (Math.random()-0.5) * 70;
        drawTwinkleOn(shineCtx, tx, ty, 18 + Math.random()*10, 0.9);
      }
    }

    shineCtx.restore();
    shineRAF = requestAnimationFrame(loop);
  };

  shineRAF = requestAnimationFrame(loop);
}

function stopShine() {
  if (!shineActive) return;
  shineActive = false;
  if (shineRAF) cancelAnimationFrame(shineRAF);
  shineRAF = null;

  shineCanvas.classList.add("off");
  setTimeout(() => {
    const r = getRect();
    shineCtx.clearRect(0, 0, r.width, r.height);
  }, 320);
}

/* SCRATCH */
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

  spawnSparkle(p.x, p.y, 0.9);
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

  for (let i = 0; i < SPARKLES_ON_SCRATCH; i++) {
    const t = Math.random();
    spawnSparkle(
      a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 10,
      a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 10,
      0.75 + Math.random() * 0.35
    );
  }
}

function maybeCelebrate() {
  if (scratchUnits > 25) hint.style.opacity = "0";

  if (!celebrated && scratchUnits >= CELEBRATE_AFTER) {
    celebrated = true;
    hint.style.opacity = "0";

    const r = canvas.getBoundingClientRect();
    sparkleBurst(r.width * 0.50, r.height * 0.52, 26);

    // ✅ mostrar outline dorado gordo
    if (!outlineOn) drawOutline();
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
  stopShine(); // al empezar a rascar
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

/* INPUT */
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

  outlineOn = false;
  outlineCanvas.classList.remove("on");
  outlineCtx.clearRect(0, 0, getRect().width, getRect().height);

  hint.style.opacity = "1";
  hint.textContent = "Rasca el corazón dorado para descubrir la hora";

  fitCanvasAll();
  drawGoldHeartOverlay();

  // ✅ vuelve el shiny al reset
  startShine();

  updateMusicBtn();
  setStatus("");
}

/* INTRO FLOW */
async function toStep0Initial() {
  introMsg1.classList.add("show");
  await typewriter(type1, caret1, TEXT_STEP1, 22);
}

async function toStep1() {
  await startMusicFromGesture();

  introMsg1.classList.remove("show");
  introMsg2.classList.add("show");
  introTap.classList.add("show");

  await typewriter(type2, caret2, TEXT_STEP2, 22);
  introStep = 1;
}

async function toStep2() {
  intro.classList.add("step2");

  if (flash) {
    flash.classList.remove("on");
    void flash.offsetWidth;
    flash.classList.add("on");
  }

  await playWhoosh();

  intro.classList.add("intro-dismiss");
  setTimeout(() => { intro.style.display = "none"; }, 520);

  stage.classList.remove("pop");
  void stage.offsetWidth;
  stage.classList.add("pop");
}

function onIntroTap(e) {
  e.preventDefault();
  if (introStep === 0) toStep1();
  else toStep2();
}

/* SETUP */
function setup() {
  requestAnimationFrame(() => resetScratch());

  intro.addEventListener("click", onIntroTap);
  intro.addEventListener("touchend", onIntroTap, { passive: false });
  intro.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") onIntroTap(e);
  });

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

  toStep0Initial();
  updateMusicBtn();
}

setup();