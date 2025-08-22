import * as BeamAPI from './beams-api.js';
import { MOD_NAME, isDebugActive } from "./beams-const.js";
import { toggleBeam, updateBeam, beams } from "./beamManager.js";
import { beamTicker } from "./beamTicker.js";
import { loadBuiltIn, loadCustomStyles } from "./StyleManager.js";
import { cMATT, isactiveModule } from './utils.js';
import { isEffectActive } from "./beams-util.js";
import { registerBeamSettings } from './beams-settings.js';
import { beamWallConfig, beamTokenConfig } from './beams-document-config.js';
import { beamWallUpdate, beamTokenUpdate, beamRefreshToken, beamsCanvasReady } from './beams-document-manage.js';

Hooks.once("init", async () => {
  if (isDebugActive) console.log("[foundry-beams] Initializing module and schema injection...");
  registerBeamSettings();


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
  beamWallConfig(app, html, data)
});


Hooks.on("renderTokenConfig", (app, html, data, opts) => {
  beamTokenConfig(app, html, data, opts)
});

Hooks.on("deleteWall", (wallDoc) => {
  if (!canvas.scene) return;

  // Update all beam-enabled tokens
  for (const token of canvas.tokens.placeables.filter(t =>
    t.document.getFlag(MOD_NAME, "beam")?.enabled
  )) {
    updateBeam(token);
  }
});


Hooks.on("updateWall", (wallDoc, updateData, options, userid) => {
  beamWallUpdate(wallDoc, updateData, options, userid)
});

Hooks.on("preMoveToken", (token, movement, _options) => {
  if (token.getFlag(MOD_NAME, "beam")) movement.autoRotate = false;
})

// Watch for token updates and react based on beam flags or movement
Hooks.on("updateToken", (tokenDoc, updateData, options, userid) => {
  beamTokenUpdate(tokenDoc, updateData, options, userid)
});

Hooks.on("refreshToken", (refreshedToken) => {
  beamRefreshToken(refreshedToken);
});

// Restore beams on scene load if tokens already have them enabled
Hooks.on("canvasReady", (canvas) => {
  beamsCanvasReady();
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

// Add our HUD button (v12 & v13 Token HUD)
Hooks.on("renderTokenHUD", async (app, html /* jQuery/HTMLElement */, data) => {
  console.log("!!!!!!!!!!!!!!! renderTokenHUD")
  try {
    // If Sequencer missing, do nothing (avoids spamming errors)
    if (!game.modules.get("sequencer")?.active) {
      console.log(`[${MOD_NAME}] Sequencer module is not active, skipping HUD button.`);
      return;
    }
    console.log(app)
    console.log(html)
    // Avoid duplicates if HUD re-renders
    if (app.form.querySelector(`#${MOD_NAME}-hud-btn`)?.length) {
      console.log(`[${MOD_NAME}] HUD button already exists, skipping.`);
      return;
    }

    // Find a column to insert the button (right column is common in v12/v13)
    const rightCol = app.form.querySelector?.(".col.right")?.first?.() || app.form.querySelector?.(".col.right");
    console.log(rightCol)
    if (!rightCol) return;

    // Create button
    const btn = document.createElement("div");
    btn.classList.add("control-icon");
    btn.id = `${MOD_NAME}-hud-btn`;
    btn.title = "Toggle Sequencer Effect";

    // Font Awesome icon (uses Foundry’s FA set)
    const i = document.createElement("i");
    i.classList.add("fa-solid", "fa-bolt");
    btn.appendChild(i);

    // Visual “active” state if effect is on
    const token = app?.object ?? canvas.tokens?.get(data._id) ?? canvas.tokens?.controlled?.[0];
    if (token && isEffectActive(token)) btn.classList.add("active");

    // Click handler
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const t = app?.object ?? canvas.tokens?.get(data._id) ?? canvas.tokens?.controlled?.[0];
      if (!t) return;

      //      await toggleEffect(t);

      // Re-check and reflect state
      if (isEffectActive(t)) btn.classList.add("active");
      else btn.classList.remove("active");
    });

    // Insert into HUD
    if (rightCol.append) rightCol.append(btn);
    else if (rightCol.appendChild) rightCol.appendChild(btn);
  } catch (err) {
    console.error(`[${MOD_NAME}] Failed to render HUD button`, err);
  }
});