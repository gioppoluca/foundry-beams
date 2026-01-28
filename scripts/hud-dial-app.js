// scripts/hud-dial-app.js
import { MOD_NAME } from "./beams-const.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;


export function openHudDialAppForToken(token) {
  if (!token) return;
  console.log("openHudDialAppForToken", token);
  new HudDialApp({ token }).render(true);
}



class HudDialApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "foundry-beams-hud-dial-app",
    window: { title: "Rune Dial", resizable: true },
    position: { width: 800, height: 600 },
    actions: {
      rotatecolor: HudDialApp.rotateColor,
      rotaterotation: HudDialApp.rotateRotation,
      togglehudactive: HudDialApp.toggleHudActive,
    }
  };

  static PARTS = {
    main: {
      id: "main",
      template: "modules/foundry-beams/templates/hud/rune-dial.hbs",
    },
  };

  constructor({ token } = {}) {
    super();
    console.log(token)
    this.token = token;
    const beam = this.token.document.getFlag(MOD_NAME, "beam") || {};

    // If an activator button is enabled, dials start inactive until the user presses it.
    this.useHudActivatorButton = !!beam?.hudUseActivatorButton;
    this.hudActivatorOffImg = beam?.hudActivatorOffImg || null;
    this.hudActivatorOnImg = beam?.hudActivatorOnImg || null;
    this.hudActive = !this.useHudActivatorButton;

    this.colors = Array.isArray(beam?.colors) ? beam.colors : [];
    const { mode, radials } = buildHudDialModel(beam);
    console.log(mode, radials)
    this.stepColor = radials.find(r => r.kind === "color")?.step ?? 0;
    this.stepRotation = radials.find(r => r.kind === "rotation")?.step ?? 0;
    this.stepsColor = radials.find(r => r.kind === "color")?.steps ?? 0;
    this.stepsRotation = radials.find(r => r.kind === "rotation")?.steps ?? 0;
    this.angleColorStep = 360 / (this.stepsColor || 1);
    this.angleRotationStep = 360 / (this.stepsRotation || 1);

    this.angleColor = radials.find(r => r.kind === "color")?.angleDeg ?? 0;
    this.angleRotation = radials.find(r => r.kind === "rotation")?.angleDeg ?? 0;

  }

  async _prepareContext(_options) {
    console.log(this.token)
    const beam = this.token.document.getFlag(MOD_NAME, "beam") || {};
    const { mode, radials } = buildHudDialModel(beam);

    // Refresh settings in case the config was changed while the app is open.
    this.useHudActivatorButton = !!beam?.hudUseActivatorButton;
    this.hudActivatorOffImg = beam?.hudActivatorOffImg || null;
    this.hudActivatorOnImg = beam?.hudActivatorOnImg || null;
    if (!this.useHudActivatorButton) this.hudActive = true;

    const activatorImg = this.hudActive ? this.hudActivatorOnImg : this.hudActivatorOffImg;


    return {
      controlHudMode: mode,
      radials,
      showActivator: this.useHudActivatorButton && radials.length > 0,
      hudActive: this.hudActive,
      hudActivatorOffImg: this.hudActivatorOffImg,
      hudActivatorOnImg: this.hudActivatorOnImg,
      hudActivatorImg: activatorImg,
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

    this._dialGridEl = root.querySelector('.hud-dial-grid');
    this._activatorImgEl = root.querySelector('[data-role="hud-activator-img"]');

    this._updateUI();
  }

  _updateUI() {
    if (this._runeColorEl?.style) this._runeColorEl.style.transform = `rotate(${this.angleColor}deg)`;
    if (this._countColorEl) this._countColorEl.textContent = String(this.stepColor);
    if (this._runeRotateEl?.style) this._runeRotateEl.style.transform = `rotate(${this.angleRotation}deg)`;
    if (this._countRotateEl) this._countRotateEl.textContent = String(this.stepRotation);

    // Toggle interactive state for the dials.
    if (this._dialGridEl) {
      this._dialGridEl.classList.toggle('fb-inactive', this.useHudActivatorButton && !this.hudActive);
    }
    if (this._activatorImgEl) {
      const nextImg = this.hudActive ? this.hudActivatorOnImg : this.hudActivatorOffImg;
      if (nextImg) this._activatorImgEl.setAttribute('src', nextImg);
    }
  }

  _canUseDials() {
    return !this.useHudActivatorButton || !!this.hudActive;
  }

  static async rotateColor() {
    console.log("rotateColor");

    this.stepColor = (this.stepColor + 1) % (this.stepsColor);
    this.angleColor = (this.angleColor + this.angleColorStep) % 360;
    this._updateUI();
    await this._persist();
  }

  static async rotateRotation() {
    console.log("rotateRotation");

    this.stepRotation = (this.stepRotation + 1) % (this.stepsRotation);
    this.angleRotation = (this.angleRotation + this.angleRotationStep) % 360;

    this._updateUI();
    await this._persist();
  }


  static async toggleHudActive() {
    if (!this.useHudActivatorButton) return;
    this.hudActive = !this.hudActive;
    this._updateUI();
  }

  async _persist() {
    if (!this.token) return;

    //const beam = this.token.document.getFlag(MOD_NAME, "beam") || {};
    //const next = foundry.utils.deepClone(beam);
    //next.hudColorStep = this.stepColor;
    //next.hudRotationStep = this.stepRotation;
    await game.modules.get(MOD_NAME).api.updateHud(
      this.token.document.uuid,
      this.colors[this.stepColor],
      this.angleRotation,
      this.stepColor,
      this.stepRotation
    );
    //next.dial = { slot: this.slot, steps: this.steps, angle: this.angle, runeImg: this.runeImg ?? null };
    //await this.token.document.setFlag(MOD_NAME, "beam", next);
  }


}


export function buildHudDialModel(beam) {
  const mode = Number(beam?.controlHudMode ?? 0);

  const shadowImg = beam?.hudDialShadowImg || null;

  /** @type {Array<{id:string, kind:"color"|"rotation", label:string, img:string|null, shadowImg:string|null, steps:number, step:number, canIncrement:boolean}>} */
  const radials = [];

  // Bit 1 => color
  if (mode & 1) {
    //const steps = clampInt(beam?.hudColorSteps, 1, 360, 12);
    //const step = clampInt(beam?.hudColorStep, 0, steps - 1, 0);
    const colors = Array.isArray(beam?.colors) ? beam.colors : [];
    const steps = Math.max(1, colors.length);
    const step = clampInt(beam?.hudColorStep, 0, steps - 1, 0);
    const angleDeg = (step / steps) * 360;
    console.log("buildHudDialModel - color", steps, step, angleDeg);
    radials.push({
      id: "color",
      kind: "color",
      label: "Color",
      img: beam?.hudDialColorImg || null,
      shadowImg,
      steps,
      step,
      canIncrement: true,
      angleDeg
    });
  }

  // Bit 2 => rotation
  if (mode & 2) {
    const steps = clampInt(beam?.hudRotationSteps, 1, 360, 12);
    const step = clampInt(beam?.hudRotationStep, 0, steps - 1, 0);
    const angleDeg = (step / steps) * 360;
    radials.push({
      id: "rotation",
      kind: "rotation",
      label: "Rotation",
      img: beam?.hudDialRotationImg || null,
      shadowImg,
      steps,
      step,
      canIncrement: true,
      angleDeg
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