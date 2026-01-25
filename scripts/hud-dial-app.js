// scripts/hud-dial-app.js
import { MOD_NAME } from "./beams-const.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;


export function openHudDialAppForToken(token) {
    if (!token) return;
    new HudDialApp(token).render(true);
}



class HudDialApp extends  HandlebarsApplicationMixin(ApplicationV2){
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "foundry-beams-hud-dial-app",
    window: { title: "Rune Dial", resizable: true },
    position: { width: 420, height: "auto" },
  });

  static PARTS = {
    main: {
      id: "main",
      template: "modules/foundry-beams/templates/hud/rune-dial.hbs",
    },
  };

  constructor({ token, slot = 1, runeImg = null, steps = 0, angle = 0 } = {}) {
    super();
    this.token = token;
    this.slot = slot;
    this.runeImg = runeImg;
    this.steps = steps;
    this.angle = angle;

    // Optional: stable ID per token/slot
    //this.options.id = `foundry-beams-hud-dial-app-${tokenUuid ?? "no-token"}-slot-${slot}`;
  }

  async _prepareContext(_options) {
    return {
      slot: this.slot,
      runeImg: this.runeImg,
      steps: this.steps,
      angle: this.angle,
      stepDeg: 30,
      maxSteps: 12,
    };
  }

  /**
   * If you use PARTS, ApplicationV2 will render them.
   * But you can also implement _renderHTML manually.
   */
  /*
  async _renderHTML(context, options) {
    const html = await this.constructor.PARTS.main.template
      ? renderTemplate(this.constructor.PARTS.main.template, context)
      : "";

    const root = document.createElement("div");
    root.innerHTML = html;

    return { root: root.firstElementChild ?? root };
  }
*/
  _onRender(context, options) {
    super._onRender(context, options);

    const root = this.element?.root ?? this.element;
    if (!root) return;

    this._runeEl = root.querySelector('[data-role="rune"]');
    this._countEl = root.querySelector('[data-role="count"]');

    root.querySelector('[data-action="rotate"]')
      ?.addEventListener("click", () => this._rotate());

    this._updateUI();
  }

  _updateUI() {
    if (this._runeEl?.style) this._runeEl.style.transform = `rotate(${this.angle}deg)`;
    if (this._countEl) this._countEl.textContent = String(this.steps);
  }

  async _rotate() {
    const STEP_DEG = 30;
    const MAX_STEPS = 12;

    this.steps = (this.steps + 1) % (MAX_STEPS + 1);
    this.angle = (this.angle + STEP_DEG) % 360;

    this._updateUI();
    await this._persist();
  }

  async _persist() {
    if (!this.token) return;
    //const doc = await fromUuid(this.token.uuid);
    //if (!doc) return;

    const beam = this.token.getFlag(MOD_NAME, "beam") || {};
    const next = foundry.utils.deepClone(beam);
    next.dial = { slot: this.slot, steps: this.steps, angle: this.angle, runeImg: this.runeImg ?? null };
    await this.token.setFlag(MOD_NAME, "beam", next);
  }
}
