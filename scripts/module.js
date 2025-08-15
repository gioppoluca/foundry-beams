import * as BeamAPI from './beams-api.js';
import { MOD_NAME, isDebugActive } from "./beams-const.js";
import { toggleBeam, updateBeam, beams } from "./beamManager.js";
import { beamTicker } from "./beamTicker.js";
import { StyleRegistry } from "./StyleRegistry.js";
import { loadBuiltIn, loadCustomStyles } from "./StyleManager.js";
import { cMATT, isactiveModule } from './utils.js';

const updateCache = new Map();


Hooks.once("init", async () => {
  if (isDebugActive) console.log("[foundry-beams] Initializing module and schema injection...");
  // Setting: debug flag
  game.settings.register("foundry-beams", "maxBounces", {
    name: "Maximum bounces",
    scope: "world",
    config: true,
    type: Number,
    default: 3,
    range: { min: 0, max: 10, step: 1 },
    requiresReload: true,
    hint: "Maximum number of bounces a beam can make before it stops.",
    onChange: val => console.log(`[foundry-beams] maxBounces ${val}`)
  });

  game.settings.register("foundry-beams", "debug", {
    name: "Enable debug logging",
    scope: "world",
    config: true,
    type: Boolean,
    requiresReload: true,
    default: false,
    onChange: val => console.log(`[foundry-beams] debug ${val ? "ON" : "OFF"}`)
  });

  game.settings.register("foundry-beams", "useProviderStyles", {
    name: "Load styles from Styles Hub module",
    hint: "If the 'foundry-beams-styles' module is active, import and register all of its styles.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.modules.get(MOD_NAME).api = BeamAPI;
  await loadBuiltIn();      // laser & lightning
  console.log(`[foundry-beams] isDebugActive:`, isDebugActive);
  console.log(`[foundry-beams] useProviderStyles`, game.settings.get("foundry-beams", "useProviderStyles"));
  if (!game.settings.get("foundry-beams", "useProviderStyles")) return;
  const hub = await game.modules.get("foundry-beams-styles");
  if (hub?.active && hub.api?.registerAll) {
    try {
      const count = await hub.api.registerAll("foundry-beams");
      console.log(`[foundry-beams] Registered ${count} styles from provider.`);
    } catch (e) {
      console.warn("[foundry-beams] Provider registerAll failed:", e);
    }
  }
  await loadCustomStyles(); // anything under custom-styles/
});

Hooks.once("ready", async () => {
  if (isDebugActive) console.log("[foundry-beams] API registered");

});

Hooks.on("renderWallConfig", (app, html, data) => {
  const mirrorData = foundry.utils.getProperty(app.document, "flags.foundry-beams.mirror") ?? {};
  console.log(mirrorData)
  if (isDebugActive) console.log(app);
  //let footer = app.form.querySelector("footer");
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

  app.form.querySelector('footer').insertAdjacentHTML('beforebegin', tabContent);
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
  const current = beamData.style ?? "laser";

  // Add Beam tab button to token config tabs
  app.form.querySelector('.sheet-tabs').insertAdjacentHTML('beforeend', `<a class="item" data-action="tab" data-group="sheet"  data-tab="beam"><i class="fas fa-lightbulb"></i> Beam</a>`);
  const options = StyleRegistry.ids().map(id => `<option value="${id}" ${current === id ? 'selected' : ''}>${id}</option>`).join("");

  // Append custom beam config form elements into the config form
  const dataGroup = game.release.generation < 13 ? "main" : "sheet";
  const tabContent = `
    <div class="tab scrollable" data-group="${dataGroup}" data-tab="beam" data-application-part="beam">
      <div class="form-group">
        <label>Enable Beam</label>
        <input type="checkbox" name="flags.foundry-beams.beam.enabled" ${beamData.enabled ? "checked" : ""}/>
      </div>
      <div class="form-group">
        <label>is active</label>
        <input type="checkbox" name="flags.foundry-beams.beam.active" ${beamData.active ? "checked" : ""}/>
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
      <label>Beam Style</label>
      <select name="flags.foundry-beams.beam.style">${options}</select>
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

  app.form.querySelector('footer').insertAdjacentHTML('beforebegin', tabContent);
  app.form.querySelector('#regionConfigButton')?.addEventListener('click', () => { regionConfig(app.token) });
});

Hooks.on("deleteWall", async (wallDoc) => {
  if (!canvas.scene) return;

  // Update all beam-enabled tokens
  for (const token of canvas.tokens.placeables.filter(t =>
    t.document.getFlag(MOD_NAME, "beam")?.enabled
  )) {
    updateBeam(token);
  }
});


Hooks.on("updateWall", (wallDoc, updateData) => {
  if (!canvas.scene) return;
  console.log("updateWall")
  console.log(wallDoc)
  console.log(updateData)
  // Only respond to walls that have moved
  if (!("c" in updateData) && !("ds" in updateData)) return;
  // Filter and update only beam-enabled tokens
  const beamTokens = canvas.tokens.placeables.filter(t => {
    //    console.log(t)
    return t.document.getFlag(MOD_NAME, "beam")?.enabled
  }
  );

  for (const token of beamTokens) {
    console.log(token)
    updateBeam(token, {}, true); // Recompute the beam for each emitter
  }
});

// Watch for token updates and react based on beam flags or movement
Hooks.on("updateToken", (tokenDoc, updateData) => {
  const token = tokenDoc;
  if (!token) return;

  const beamConfig = token.getFlag(MOD_NAME, "beam");
  const isEnabled = beamConfig?.enabled === true;
  const isActive = beamConfig?.active === true;
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

  const changedStyle = updateData?.flags?.["foundry-beams"]?.beam?.style !== undefined;
  const changedColor = updateData?.flags?.["foundry-beams"]?.beam?.colorHex !== undefined;
  const changedWidth = updateData?.flags?.["foundry-beams"]?.beam?.width !== undefined;
  const changedOffset = updateData?.flags?.["foundry-beams"]?.beam?.offset !== undefined;
  const changedActive = updateData?.flags?.["foundry-beams"]?.beam?.active !== undefined;
  console.log(updateData?.flags?.["foundry-beams"]?.beam?.style)
  console.log(updateData?.flags?.["foundry-beams"]?.beam?.colorHex)
  console.log("Changed:", (changedStyle || changedColor))
  if (isEnabled && (changedStyle || changedColor || changedWidth || changedOffset || changedActive)) {
    if (isDebugActive) console.log(`[foundry-beams] Scheduling beam update due to token motion: ${token.name}`);
    //updateCache.set(token.id, updateData);
    updateBeam(token.object, updateData);
  }
});

Hooks.on("refreshToken", (refreshedToken) => {
  const tokenId = refreshedToken.id;
  console.log("refreshToken")
  console.log(refreshedToken)
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
  beamTicker.start();
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


// MATT integration
Hooks.on("setupTileActions", (app) => {
  if (isactiveModule(cMATT)) {
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
          options: { show: ['tagger'] },
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
      group: MOD_NAME,
      fn: async (args = {}) => {
        const { action } = args;
        // get the array of entities from MATT
        let beamT = await app.getEntities(args)

        // Get the API for the beam module
        const beams = game.modules.get(MOD_NAME).api;
        // call API to rotate of set value for all entities
        for (const aBeam of beamT) {
          await beams.rotateBeamByIdOf(aBeam.uuid, args.action.data.rotateof);
        }
      },
      content: async (trigger, action) => {
        let entityName = await app.entityName(action.data?.entity);
        return `<span class="action-style">${trigger.name}</span>, <span class="entity-style" style="margin-right: 8px;">token: ${action.data.entity.name}</span> rotation: ${action.data.rotateof}`;

      }
    });

    app.registerTileAction(MOD_NAME, 'beam-rotate-to', {
      name: "Rotate Beam To",
      batch: false,
      requiresGM: true,
      ctrls: [
        {
          id: "entity",
          name: "Select Beam Emitter",
          type: "select",
          subtype: "entity",
          options: { show: ['tagger'] },
          restrict: (entity) => { return (entity instanceof Token); },  //this needs to be a token
          required: true,
          defaultType: 'tokens',
          placeholder: 'Please select a Token that is an emitter'
        },
        {
          id: "rotateto",
          name: "Rotate To",
          type: "number",
          min: 0,
          max: 360,
          step: 5,
          defvalue: 0
        }
      ],
      fn: async (args = {}) => {
        const { action } = args;
        let beamT = await app.getEntities(args)

        // Get the API for the beam module
        const beams = game.modules.get(MOD_NAME).api;
        for (const aBeam of beamT) {
          // call API to rotate to set value
          await beams.rotateBeamByIdTo(aBeam.uuid, args.action.data.rotateto);
        }

      },
      content: async (trigger, action) => {
        return `<span class="action-style">${trigger.name}</span>, <span class="entity-style" style="margin-right: 8px;">token: ${action.data.entity.name}</span> rotation: ${action.data.rotateto}`;
      }
    });

    app.registerTileAction(MOD_NAME, 'beam-toggle', {
      name: "Toggle",
      batch: false,
      requiresGM: true,
      ctrls: [
        {
          id: "entity",
          name: "Select Beam Emitter",
          type: "select",
          subtype: "entity",
          options: { show: ['tagger'] },
          restrict: (entity) => { return (entity instanceof Token); },  //this needs to be a token
          required: true,
          defaultType: 'tokens',
          placeholder: 'Please select a Token that is an emitter'
        }
      ],
      fn: async (args = {}) => {
        const { action } = args;
        let beamT = await app.getEntities(args)

        // Get the API for the beam module
        const beams = game.modules.get(MOD_NAME).api;
        for (const aBeam of beamT) {
          // call API to toggle activation
          await beams.toggleActivationBeamById(aBeam.uuid);
        }

      },
      content: async (trigger, action) => {
        return `<span class="action-style">${trigger.name}</span>, <span class="entity-style" style="margin-right: 8px;">token: ${action.data.entity.name}</span>`;
      }
    });

    app.registerTileAction(MOD_NAME, 'beam-activate', {
      name: "Activate",
      batch: false,
      requiresGM: true,
      ctrls: [
        {
          id: "entity",
          name: "Select Beam Emitter",
          type: "select",
          subtype: "entity",
          options: { show: ['tagger'] },
          restrict: (entity) => { return (entity instanceof Token); },  //this needs to be a token
          required: true,
          defaultType: 'tokens',
          placeholder: 'Please select a Token that is an emitter'
        }
      ],
      fn: async (args = {}) => {
        const { action } = args;
        let beamT = await app.getEntities(args)

        // Get the API for the beam module
        const beams = game.modules.get(MOD_NAME).api;
        for (const aBeam of beamT) {
          // call API to activate
          await beams.activateBeamById(aBeam.uuid);
        }

      },
      content: async (trigger, action) => {
        return `<span class="action-style">${trigger.name}</span>, <span class="entity-style" style="margin-right: 8px;">token: ${action.data.entity.name}</span>`;
      }
    });

    app.registerTileAction(MOD_NAME, 'beam-deactivate', {
      name: "Deactivate",
      batch: false,
      requiresGM: true,
      ctrls: [
        {
          id: "entity",
          name: "Select Beam Emitter",
          type: "select",
          subtype: "entity",
          options: { show: ['tagger'] },
          restrict: (entity) => { return (entity instanceof Token); },  //this needs to be a token
          required: true,
          defaultType: 'tokens',
          placeholder: 'Please select a Token that is an emitter'
        }
      ],
      fn: async (args = {}) => {
        const { action } = args;
        let beamT = await app.getEntities(args)

        // Get the API for the beam module
        const beams = game.modules.get(MOD_NAME).api;
        for (const aBeam of beamT) {
          // call API to disactivate
          await beams.disactivateBeamById(aBeam.uuid);
        }

      },
      content: async (trigger, action) => {
        return `<span class="action-style">${trigger.name}</span>, <span class="entity-style" style="margin-right: 8px;">token: ${action.data.entity.name}</span>`;
      }
    });
  }
});

Hooks.once("shutdown", () => {
  beamTicker.stop();
});
