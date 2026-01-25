// scripts/beams-hover-hud.js
import { MOD_NAME } from "./beams-const.js";
import { openHudDialAppForToken } from "./hud-dial-app.js";

let hudEl = null;

// STICKY state
let activeToken = null;        // token we control while HUD is visible
let isHoveringToken = false;   // true while mouse over token
let isHoveringHud = false;     // true while mouse over HUD
let hideTimer = null;

const HIDE_DELAY_MS = 200;

function tokenOptedIn(token) {
  const beam = token?.document?.getFlag(MOD_NAME, "beam");
  const mode = Number(beam?.controlHudMode ?? 0);
  return !!(beam?.enabled && mode > 0);
}

function clearHideTimer() {
  if (!hideTimer) return;
  clearTimeout(hideTimer);
  hideTimer = null;
}

function scheduleHide() {
  clearHideTimer();
  hideTimer = setTimeout(() => {
    // hide only if neither token nor HUD is hovered
    if (!isHoveringToken && !isHoveringHud) {
      hideHud();
      activeToken = null;
    }
  }, HIDE_DELAY_MS);
}

function ensureHudEl() {
  if (hudEl) return hudEl;

  hudEl = document.createElement("div");
  hudEl.id = `${MOD_NAME}-hover-hud`;
  hudEl.style.position = "fixed";
  hudEl.style.zIndex = "10000";
  hudEl.style.width = "28px";
  hudEl.style.height = "28px";
  hudEl.style.display = "none";
  hudEl.style.alignItems = "center";
  hudEl.style.justifyContent = "center";
  hudEl.style.borderRadius = "6px";
  hudEl.style.cursor = "pointer";
  hudEl.style.userSelect = "none";
  hudEl.style.boxShadow = "0 2px 10px rgba(0,0,0,.35)";
  hudEl.style.background = "rgba(20,20,20,.75)";
  hudEl.style.backdropFilter = "blur(2px)";
  hudEl.innerHTML = `<i class="fas fa-sliders-h" style="color: rgba(255,255,255,.9)"></i>`;

  hudEl.addEventListener("mouseenter", () => {
    isHoveringHud = true;
    clearHideTimer();
    hudEl.style.background = "rgba(40,40,40,.85)";
  });

  hudEl.addEventListener("mouseleave", () => {
    isHoveringHud = false;
    hudEl.style.background = "rgba(20,20,20,.75)";
    if (!isHoveringToken) scheduleHide();
  });

  hudEl.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();

    // IMPORTANT: use activeToken, not "currently hovered"
    const token = activeToken;
    if (!token) return;
    console.log("[Foundry Beams] Opening HUD Dial App for token", token);

    openHudDialAppForToken(token);
  });

  document.body.appendChild(hudEl);
  return hudEl;
}

function showHud() {
  ensureHudEl();
  hudEl.style.display = "flex";
}

function hideHud() {
  if (!hudEl) return;
  hudEl.style.display = "none";
}

// Keep your existing positioning logic, but base it on activeToken
function updateHudPosition() {
  if (!activeToken || !hudEl || hudEl.style.display === "none") return;

  const { x, y } = activeToken.center;
  const t = canvas.stage.worldTransform;

  const sx = (t.a * x) + (t.c * y) + t.tx;
  const sy = (t.b * x) + (t.d * y) + t.ty;

  const rect = canvas.app.view.getBoundingClientRect();
  const offsetX = 22;
  const offsetY = -28;

  hudEl.style.left = `${rect.left + sx + offsetX}px`;
  hudEl.style.top  = `${rect.top + sy + offsetY}px`;
}

let tickerFn = null;
function startTicker() {
  if (tickerFn) return;
  tickerFn = () => updateHudPosition();
  canvas.app.ticker.add(tickerFn);
}
function stopTicker() {
  if (!tickerFn) return;
  canvas.app.ticker.remove(tickerFn);
  tickerFn = null;
}

export function initBeamsHoverHud() {
  ensureHudEl();

  Hooks.on("hoverToken", (token, hovered) => {
    if (!token) return;

    if (hovered) {
      // entering token
      if (!tokenOptedIn(token)) return;

      isHoveringToken = true;
      activeToken = token;          // STICKY assignment
      clearHideTimer();
      showHud();
      updateHudPosition();
      startTicker();
      return;
    }

    // leaving token
    if (activeToken === token) {
      isHoveringToken = false;

      // Do NOT clear activeToken here.
      // Give time to move mouse onto HUD.
      if (!isHoveringHud) scheduleHide();
      stopTicker();
    }
  });

  Hooks.on("canvasPan", () => updateHudPosition());
}
