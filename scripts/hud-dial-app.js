// scripts/hud-dial-app.js
import { MOD_NAME } from "./beams-const.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;


export function openHudDialAppForToken(token) {
  if (!token) return;
  console.log("openHudDialAppForToken", token);
  new HudDialApp({ token }).render(true);
}



class HudDialApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "foundry-beams-hud-dial-app",
    window: { title: "Rune Dial", resizable: true },
    position: { width: 420, height: "auto" },
    actions: {
      rotatecolor: HudDialApp.rotateColor,
      rotaterotation: HudDialApp.rotateRotation,
    }
  });

  static PARTS = {
    main: {
      id: "main",
      template: "modules/foundry-beams/templates/hud/rune-dial.hbs",
    },
  };

  constructor({ token, slot = 1, runeImg = null, steps = 0, angle = 0 } = {}) {
    super();
    console.log(token, slot, runeImg, steps, angle)
    this.token = token;
    this.slot = slot;
    this.runeImg = runeImg;
    this.stepsColor = 0;
    this.stepsRotation = 0;
    this.angleColor = 0;
    this.angleRotation = 0;

    // Optional: stable ID per token/slot
    //this.options.id = `foundry-beams-hud-dial-app-${tokenUuid ?? "no-token"}-slot-${slot}`;
  }

  async _prepareContext(_options) {
    console.log(this.token)
    const beam = this.token.document.getFlag(MOD_NAME, "beam") || {};
    const { mode, radials } = buildHudDialModel(beam);

    this.stepsColor=radials.find(r => r.kind==="color")?.step ?? 0;
    this.stepsRotation=radials.find(r => r.kind==="rotation")?.step ?? 0;
    this.angleColor=(this.stepsColor * (360 / (radials.find(r => r.kind==="color")?.steps ?? 12))) % 360;
    this.angleRotation=(this.stepsRotation * (360 / (radials.find(r => r.kind==="rotation")?.steps ?? 12))) % 360;


    return {
      controlHudMode: mode,
      radials,
    };
  }

  /**
   * If you use PARTS, ApplicationV2 will render them.
   * But you can also implement _renderHTML manually.
   */
  _onRender(context, options) {
    super._onRender(context, options);

    const root = this.element?.root ?? this.element;
    if (!root) return;

    this._runeColorEl = root.querySelector('[data-role="runecolor"]');
    this._countColorEl = root.querySelector('[data-role="countcolor"]');
    this._runeRotateEl = root.querySelector('[data-role="runerotation"]');
    this._countRotateEl = root.querySelector('[data-role="countrotation"]');

    this._updateUI();
  }

  _updateUI() {
    if (this._runeColorEl?.style) this._runeColorEl.style.transform = `rotate(${this.angleColor}deg)`;
    if (this._countColorEl) this._countColorEl.textContent = String(this.stepsColor);
    if (this._runeRotateEl?.style) this._runeRotateEl.style.transform = `rotate(${this.angleRotation}deg)`;
    if (this._countRotateEl) this._countRotateEl.textContent = String(this.stepsRotation);
  }

  static async rotateColor() {
    console.log("rotateColor");
    const STEP_DEG = 30;
    const MAX_STEPS = 12;

    this.stepsColor = (this.stepsColor + 1) % (MAX_STEPS + 1);
    this.angleColor = (this.angleColor + STEP_DEG) % 360;
    this._updateUI();
    await this._persist();
  }

  static async rotateRotation() {
    console.log("rotateRotation");
    const STEP_DEG = 30;
    const MAX_STEPS = 12;

    this.stepsRotation = (this.stepsRotation + 1) % (MAX_STEPS + 1);
    this.angleRotation = (this.angleRotation + STEP_DEG) % 360;

    this._updateUI();
    await this._persist();
  }


  async _persist() {
    if (!this.token) return;

    const beam = this.token.document.getFlag(MOD_NAME, "beam") || {};
    const next = foundry.utils.deepClone(beam);
    next.hudColorStep = this.stepsColor;
    next.hudRotationStep = this.stepsRotation;
    //next.dial = { slot: this.slot, steps: this.steps, angle: this.angle, runeImg: this.runeImg ?? null };
    await this.token.document.setFlag(MOD_NAME, "beam", next);
  }


}


export function buildHudDialModel(beam) {
  const mode = Number(beam?.controlHudMode ?? 0);

  const shadowImg = beam?.hudDialShadowImg || null;

  /** @type {Array<{id:string, kind:"color"|"rotation", label:string, img:string|null, shadowImg:string|null, steps:number, step:number, canIncrement:boolean}>} */
  const radials = [];

  // Bit 1 => color
  if (mode & 1) {
    const steps = clampInt(beam?.hudColorSteps, 1, 360, 12);
    const step = clampInt(beam?.hudColorStep, 0, steps - 1, 0);
    radials.push({
      id: "color",
      kind: "color",
      label: "Color",
      img: beam?.hudDialColorImg || null,
      shadowImg,
      steps,
      step,
      canIncrement: true,
    });
  }

  // Bit 2 => rotation
  if (mode & 2) {
    const steps = clampInt(beam?.hudRotationSteps, 1, 360, 12);
    const step = clampInt(beam?.hudRotationStep, 0, steps - 1, 0);
    radials.push({
      id: "rotation",
      kind: "rotation",
      label: "Rotation",
      img: beam?.hudDialRotationImg || null,
      shadowImg,
      steps,
      step,
      canIncrement: true,
    });
  }

  return {
    mode,
    radials,
    // convenient for UI
    show: radials.length > 0,
  };
}

function clampInt(value, min, max, fallback) {
  const n = Number.isFinite(Number(value)) ? Number(value) : fallback;
  const i = Math.floor(n);
  return Math.max(min, Math.min(max, i));
}