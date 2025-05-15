export const isDebugActive = true;
import { MOD_NAME } from "./beams-const.js";
// module.js (refactored with detailed comments and debug console output)
import * as BeamAPI from './beams-api.js';
import { toggleBeam, updateBeam, beams } from "./beamManager.js";

Hooks.once("init", () => {
  if (isDebugActive) console.log("[foundry-beams] Initializing module and schema injection...");

  // Inject default beam flag schema into token config
  CONFIG.Token.sheetClasses["base"].cls.prototype.injectConfigSheetFields ??= function (fields) {
    fields["flags.foundry-beams.beam"] = {
      type: Object,
      default: {
        enabled: false,
        width: 30,
        colorHex: "#ffe699"
      }
    };
  };
  CONFIG.Wall.sheetClasses["base"].cls.prototype.injectConfigSheetFields ??= function (fields) {
    fields["flags.foundry-beams.mirror"] = {
      type: Object,
      default: {
        isMirror: false,
        isReactive: false,
        macro: ""
      }
    };
  };
});

Hooks.once("ready", () => {
  game.modules.get(MOD_NAME).api = BeamAPI;
  if (isDebugActive) console.log("[foundry-beams] API registered");
});

Hooks.on("renderWallConfig", (app, html, data) => {
  const mirrorData = foundry.utils.getProperty(app.object, "flags.foundry-beams.mirror") ?? {};
  console.log(mirrorData)
  if (isDebugActive) console.log(app);
  if (isDebugActive) console.log(`[foundry-beams] Rendering WallConfig UI for wall: ${app.object.id}`);
  let footer = html.find("footer");
  const tabContent = `
    <fieldset class="beam-group" data-tab="beam">
      <div class="form-group">
        <label>Is mirror</label>
        <input type="checkbox" name="flags.foundry-beams.mirror.isMirror" ${mirrorData.isMirror ? "checked" : ""}/>
      </div>
      <div class="form-group">
        <label>Is reactive</label>
        <input type="checkbox" name="flags.foundry-beams.mirror.isReactive" ${mirrorData.isReactive ? "checked" : ""}/>
      </div>
      <div class="form-group">
        <label>Macro for reactive</label>
        <input type="string" name="flags.foundry-beams.mirror.macro" value="${mirrorData.macro ?? ""}" />
      </div>
    </fieldset>
  `;

  // let lastChild = form.children().last();
  // console.log(lastChild)
  footer.before(tabContent);
  //vprevTab.append(tabContent)
  app.setPosition({ height: "auto" });
});

Hooks.on("renderTokenConfig", (app, html, data) => {
  const beamData = foundry.utils.getProperty(app.object, "flags.foundry-beams.beam") ?? {};

  if (isDebugActive) console.log(`[foundry-beams] Rendering TokenConfig UI for token: ${app.object.name}`);

  // Add Beam tab button to token config tabs
  html.find(".sheet-tabs").append(`<a class="item" data-tab="beam"><i class="fas fa-lightbulb"></i> Beam</a>`);

  // Append custom beam config form elements into the config form
  let form = html.find("form");
  const tabContent = `
    <div class="tab" data-tab="beam">
      <div class="form-group">
        <label>Enable Beam</label>
        <input type="checkbox" name="flags.foundry-beams.beam.enabled" ${beamData.enabled ? "checked" : ""}/>
      </div>
      <div class="form-group">
        <label>Beam Width (px)</label>
        <input type="number" name="flags.foundry-beams.beam.width" value="${beamData.width ?? 30}" min="1"/>
      </div>
      <div class="form-group">
        <label>Beam Color</label>
        <input type="color" name="flags.foundry-beams.beam.colorHex" value="${beamData.colorHex ?? "#ffe699"}"/>
      </div>
    </div>
  `;
  form.append(tabContent);
});

// Watch for token updates and react based on beam flags or movement
Hooks.on("updateToken", (tokenDoc, updateData) => {
  const token = tokenDoc;
  if (!token) return;

  const beamConfig = token.getFlag(MOD_NAME, "beam");
  const isEnabled = beamConfig?.enabled === true;
  const beamExists = beams.has(token.id);

  if (isDebugActive) console.log(`[foundry-beams] Token updated: ${token.name}`);
  if (isDebugActive) console.log(`[foundry-beams] Beam flag enabled: ${isEnabled}, Beam already exists: ${beamExists}`);

  // Handle enabling the beam
  if (isEnabled && !beamExists) {
    if (isDebugActive) console.log(`[foundry-beams] Scheduling beam creation for ${token.name}`);
    Hooks.once("refreshToken", (refreshed) => {
      if (refreshed.id === token.id) {
        if (isDebugActive) console.log(`[foundry-beams] Creating beam after refresh for ${token.name}`);
        toggleBeam(token, true);
      }
    });
  }

  // Handle disabling the beam
  if (!isEnabled && beamExists) {
    if (isDebugActive) console.log(`[foundry-beams] Scheduling beam destruction for ${token.name}`);
    Hooks.once("refreshToken", (refreshed) => {
      if (refreshed.id === token.id) {
        if (isDebugActive) console.log(`[foundry-beams] Destroying beam after refresh for ${token.name}`);
        toggleBeam(token, false);
      }
    });
  }

  // If the token has moved or rotated, update the beam geometry
  const moved = "x" in updateData || "y" in updateData || "rotation" in updateData;
  if (isEnabled && moved) {
    if (isDebugActive) console.log(`[foundry-beams] Scheduling beam update due to token motion: ${token.name}`);
    Hooks.once("refreshToken", (refreshed) => {
      if (refreshed.id === token.id) {
        requestAnimationFrame(() => {
          if (isDebugActive) console.log(`[foundry-beams] Updating beam geometry after refresh for ${token.name}`);
          if (isDebugActive) console.log(refreshed);
          updateBeam(refreshed, updateData); // <--- pass the updateData
        });
      }
    });
  }
});

// Restore beams on scene load if tokens already have them enabled
Hooks.on("canvasReady", (canvas) => {
  if (isDebugActive) console.log("[foundry-beams] Canvas ready. Checking tokens for beam restoration...");
  if (isDebugActive) console.log(beams);

  // All sensors in scene
  let all_beams = canvas.tokens.placeables.filter((tok) => {
    return tok.document.getFlag(MOD_NAME, "beam");
  });

  console.log("canvasready")
  console.log(all_beams)

  for (const token of all_beams) {
    const beamConfig = token.document.getFlag(MOD_NAME, "beam");
    if (isDebugActive) console.log(beamConfig);
    if (beamConfig?.enabled) {
      if (isDebugActive) console.log(`[foundry-beams] Restoring beam for ${token.name}`);
      toggleBeam(token, true);
    }
  }
});

