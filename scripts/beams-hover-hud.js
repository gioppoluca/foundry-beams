// scripts/beams-hover-hud.js
import { MOD_NAME } from "./beams-const.js";

/**
 * Floating hover HUD button that:
 * - appears when hovering a token opted-in via flags
 * - stays visible when you move mouse from token -> button
 * - works regardless of token ownership (visibility-wise)
 *
 * NOTE: The click handler calls your module API. If that API updates Token flags,
 * non-owners will still need a GM-mediated path (socketlib). See explanation below.
 */

let hudEl = null;
let hoveredToken = null;
let isPointerOverHud = false;
let hideTimer = null;
let tickerFn = null;

const HIDE_DELAY_MS = 180; // grace time to move token -> button

function tokenOptedIn(token) {
    const beam = token?.document?.getFlag(MOD_NAME, "beam");
    return !!(beam?.enabled && beam?.useControlHud);
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
    hudEl.style.pointerEvents = "auto";
    hudEl.style.boxShadow = "0 2px 10px rgba(0,0,0,.35)";
    hudEl.style.background = "rgba(20,20,20,.75)";
    hudEl.style.backdropFilter = "blur(2px)";
    hudEl.innerHTML = `<i class="fas fa-bolt" style="color: rgba(255,255,255,.9)"></i>`;

    hudEl.title = game.i18n.localize("foundry-beams.HUD.ToggleSequencerEffect");

    hudEl.addEventListener("mouseenter", () => {
        isPointerOverHud = true;
        clearHideTimer();
        hudEl.style.background = "rgba(40,40,40,.85)";
    });

    hudEl.addEventListener("mouseleave", () => {
        isPointerOverHud = false;
        hudEl.style.background = "rgba(20,20,20,.75)";
        // If token isn't hovered anymore, we can hide after a tiny delay
        if (!hoveredToken) scheduleHide();
    });

    hudEl.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
console.log("HUD clicked");
        const token = hoveredToken;
        if (!token?.document) return;

        const api = game.modules.get(MOD_NAME)?.api;
        if (!api?.toggleActivationBeamById) {
            ui.notifications?.error(`${MOD_NAME}: api.toggleActivationBeamById not found`);
            return;
        }

        // Use UUID so it’s unambiguous
        await api.toggleActivationBeamById(token.document.uuid);

        // Update visual state (active/not active) after toggle
        const beam = token.document.getFlag(MOD_NAME, "beam") || {};
        hudEl.classList.toggle("active", !!beam.active);
    });

    document.body.appendChild(hudEl);
    return hudEl;
}

function clearHideTimer() {
    if (!hideTimer) return;
    clearTimeout(hideTimer);
    hideTimer = null;
}

function scheduleHide() {
    clearHideTimer();
    hideTimer = setTimeout(() => {
        // Hide only if we're not hovering the HUD and not hovering any token
        if (!isPointerOverHud && !hoveredToken) hideHud();
    }, HIDE_DELAY_MS);
}

function showHud(token) {
    ensureHudEl();
    hudEl.style.display = "flex";
    const beam = token.document.getFlag(MOD_NAME, "beam") || {};
    hudEl.classList.toggle("active", !!beam.active);
}

function hideHud() {
    if (!hudEl) return;
    hudEl.style.display = "none";
}

function updateHudPosition() {
    if (!hoveredToken || !hudEl) return;

    const { x, y } = hoveredToken.center;          // world coords
    const t = canvas.stage.worldTransform;         // world -> screen-in-canvas

    const screenX = (t.a * x) + (t.c * y) + t.tx;
    const screenY = (t.b * x) + (t.d * y) + t.ty;

    const rect = canvas.app.view.getBoundingClientRect(); // canvas in browser

    // Put the button near the token
    const offsetX = 22;
    const offsetY = -28;

    hudEl.style.left = `${rect.left + screenX + offsetX}px`;
    hudEl.style.top = `${rect.top + screenY + offsetY}px`;
}

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
    if (initBeamsHoverHud._bound) return;
    initBeamsHoverHud._bound = true;

    ensureHudEl();

    Hooks.on("hoverToken", (token, hovered) => {
        if (!token) return;

        if (hovered) {
            if (!tokenOptedIn(token)) {
                hoveredToken = null;
                if (!isPointerOverHud) hideHud();
                stopTicker();
                return;
            }
            hoveredToken = token;
            clearHideTimer();
            showHud(token);
            updateHudPosition();
            startTicker();
            return;
        }

        // leaving token: don't instantly hide; allow moving onto HUD
        if (hoveredToken === token) hoveredToken = null;
        stopTicker();

        if (!isPointerOverHud) scheduleHide();
    });

    Hooks.on("canvasPan", () => {
        if (!hudEl || hudEl.style.display === "none") return;
        updateHudPosition();
    });
}
