export const isDebugActive = true;
import { MOD_NAME } from "./beams-const.js";
import * as BeamAPI from './beams-api.js';
import { toggleBeam, updateBeam, beams } from "./beamManager.js";
const updateCache = new Map();

Hooks.once("init", () => {
  if (isDebugActive) console.log("[foundry-beams] Initializing module and schema injection...");
  // Inject default beam flag schema into token config
  CONFIG.Token.sheetClasses["base"].cls.prototype.injectConfigSheetFields ??= function (fields) {
    fields["flags.foundry-beams.beam"] = {
      type: Object,
      default: {
        enabled: false,
        width: 30,
        offset: 30,
        hasRegion: false,
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

  footer.before(tabContent);
  app.setPosition({ height: "auto" });
});

// this function could go to the proper file
async function regionConfig(token) {
  console.log("regionConfig");
  const regionName = `Beam-${token.name}-Region`;
  let region = game.scenes.viewed.regions.getName(regionName)
  if (!region) {
    const regionData = {
      shapes: [],
      name: `Beam-${token.name}-Region`,
      visibility: 2,
      x: 0,
      y: 0
    };
    console.log(regionData)
    region = (await canvas.scene.createEmbeddedDocuments("Region", [regionData]))[0];
  }
  let renderedConfig = await (new foundry.applications.sheets.RegionConfig({ document: region }).render({ force: true }));
  renderedConfig.element.querySelector('section.tab.region-behaviors').classList += ' active';
}

Hooks.on("renderTokenConfig", (app, html, data) => {
  const beamData = foundry.utils.getProperty(app.token, "flags.foundry-beams.beam") ?? {};

  console.log(app)
  console.log(html)
  console.log(beamData)
  if (isDebugActive) console.log(`[foundry-beams] Rendering TokenConfig UI for token: ${app.token.name}`);

  // Add Beam tab button to token config tabs
  app.form.querySelector('.sheet-tabs').insertAdjacentHTML('beforeend', `<a class="item" data-action="tab" data-group="sheet"  data-tab="beam"><i class="fas fa-lightbulb"></i> Beam</a>`);

  // Append custom beam config form elements into the config form
  const dataGroup = game.release.generation < 13 ? "main" : "sheet";
  const tabContent = `
    <div class="tab scrollable" data-group="${dataGroup}" data-tab="beam" data-application-part="beam">
      <div class="form-group">
        <label>Enable Beam</label>
        <input type="checkbox" name="flags.foundry-beams.beam.enabled" ${beamData.enabled ? "checked" : ""}/>
      </div>
      <div class="form-group">
        <label>Beam Width (px)</label>
        <input type="number" name="flags.foundry-beams.beam.width" value="${beamData.width ?? 30}" min="1"/>
      </div>
      <div class="form-group">
        <label>Beam Offset (px)</label>
        <input type="number" name="flags.foundry-beams.beam.offset" value="${beamData.offset ?? 30}" min="1"/>
      </div>
      <div class="form-group">
        <label>Beam Color</label>
        <input type="color" name="flags.foundry-beams.beam.colorHex" value="${beamData.colorHex ?? "#ffe699"}"/>
      </div>
      <div class="form-group">
        <label>Activate region on beam?</label>
        <input type="checkbox" name="flags.foundry-beams.beam.hasRegion" ${beamData.hasRegion ? "checked" : ""}/>
      </div>
      <div class="form-group">
        <button id="regionConfigButton" >Configure Region</button>
      </div>
    </div>
  `;

  //form.append(tabContent);
  app.form.querySelector('footer').insertAdjacentHTML('beforebegin', tabContent);
  app.form.querySelector('#regionConfigButton')?.addEventListener('click', () => { regionConfig(app.token) });
});

// Watch for token updates and react based on beam flags or movement
Hooks.on("updateToken", (tokenDoc, updateData) => {
  const token = tokenDoc;
  if (!token) return;

  const beamConfig = token.getFlag(MOD_NAME, "beam");
  const isEnabled = beamConfig?.enabled === true;
  const beamExists = beams.has(token.id);

  if (isDebugActive) console.log(tokenDoc);
  if (isDebugActive) console.log(updateData);
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

  // If the token has moved or rotated, cache the update and let refreshToken do the job
  const moved = "x" in updateData || "y" in updateData || "rotation" in updateData;
  if (isEnabled && moved) {
    if (isDebugActive) console.log(`[foundry-beams] Scheduling beam update due to token motion: ${token.name}`);
    updateCache.set(token.id, updateData);
  }

});

Hooks.on("refreshToken", (refreshedToken) => {
  const tokenId = refreshedToken.id;
  if (!updateCache.has(tokenId)) return;

  const cachedUpdate = updateCache.get(tokenId);
  updateCache.delete(tokenId); // Consume only once per move

  if (isDebugActive) {
    console.log(`[foundry-beams] RefreshToken match for ${refreshedToken.name}, applying cached update.`);
    console.log(cachedUpdate);
  }

  updateBeam(refreshedToken, cachedUpdate);
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
      console.log(token)
      toggleBeam(token.document, true);
    }
  }
});

Hooks.on("setupTileActions", (app) => {
  console.log("GIOPPO beam on MATT")
  app.registerTileGroup(MOD_NAME, "Active Beams");

  app.registerTileAction(MOD_NAME, 'beam-rotate-of', {
    name: "Rotate Beam Of",
    batch: false,
    requiresGM: true,
    ctrls: [
      {
        id: "entity",
        name: "Select Beam Emitter",
        type: "select",
        subtype: "entity",
        options: { show: ['previous', 'tagger'] },
        restrict: (entity) => { return (entity instanceof Token); },  //this needs to be a token
        required: true,
        defaultType: 'tokens',
        placeholder: 'Please select a Token that is an emitter'
      },
      {
        id: "rotateof",
        name: "Rotate Of",
        type: "number",
        min: 0,
        max: 360,
        step: 5,
        defvalue: 0
      }
    ],
    fn: async (args = {}) => {
      const { action } = args;
      // Get the API for the beam module
      const beams = game.modules.get("foundry-beams").api;
      // call API to rotate of set value
      await beams.rotateBeamByIdOf(args.action.data.entity.id, args.action.data.rotateof);

    },
    content: async (trigger, action) => {
      return `<span class="action-style">${trigger.name}</span>, <span class="entity-style" style="margin-right: 8px;">token: ${action.data.entity.name}</span> rotation: ${action.data.rotateof}`;
    }
  });

});