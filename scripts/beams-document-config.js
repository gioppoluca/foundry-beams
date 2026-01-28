import { MOD_NAME, isDebugActive } from "./beams-const.js";
import { StyleRegistry } from "./StyleRegistry.js";
import { openBeamColorsEditor } from "./hud-colors-editor-app.js";

export function beamWallConfig(app, html, data) {
  const mirrorData = foundry.utils.getProperty(app.document, "flags.foundry-beams.mirror") ?? {};
  console.log(mirrorData)
  if (isDebugActive) console.log(app);
  const tabContent = `
    <fieldset class="beam-group" data-tab="beam">
      <legend>${game.i18n.localize("foundry-beams.WallConfigLegend")}</legend>

      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.IsMirror")}</label>
        <input id="fb-isMirror" type="checkbox" name="flags.foundry-beams.mirror.isMirror" ${mirrorData.isMirror ? "checked" : ""}/>
      </div>

      <fieldset class="fb-fields" id="fb-reactive">
        <legend>${game.i18n.localize("foundry-beams.WallConfigIsReactiveLegend")}</legend>
        <div class="form-group">
          <label title="${game.i18n.localize("foundry-beams.IsReactiveTooltip")}">${game.i18n.localize("foundry-beams.IsReactive")}</label>
          <input id="fb-isReactive" type="checkbox" name="flags.foundry-beams.mirror.isReactive" ${mirrorData.isReactive ? "checked" : ""}/>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("foundry-beams.MacroForReactive")}</label>
          <input id="fb-macro" type="text" data-dtype="String"
                 name="flags.foundry-beams.mirror.macro"
                 value="${mirrorData.macro ?? ""}" />
        </div>
      </fieldset>

      <fieldset class="fb-fields" id="fb-reactive-exit">
        <legend>${game.i18n.localize("foundry-beams.WallConfigIsReactiveExitLegend")}</legend>
        <div class="form-group">
          <label title="${game.i18n.localize("foundry-beams.IsReactiveExitTooltip")}">${game.i18n.localize("foundry-beams.IsReactive")}</label>
          <input id="fbIsReactiveExit" type="checkbox" name="flags.foundry-beams.mirror.isReactiveExit" ${mirrorData.isReactiveExit ? "checked" : ""}/>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("foundry-beams.MacroForReactive")}</label>
          <input id="fbMacroExit" type="text" data-dtype="String"
                 name="flags.foundry-beams.mirror.macroExit"
                 value="${mirrorData.macroExit ?? ""}" />
        </div>
      </fieldset>
    </fieldset>
  `;

  // Wire dynamic behavior
  console.log(app, html, data);
  //const form = app.form;
  //const el = (sel) => form.querySelector(sel);

  //  const chkMirror       = el('#fb-isMirror');
  //const fsReactive      = el('#fb-reactive');
  const chkReactive = app.form.querySelector('#fb-isReactive');
  const inpMacro = app.form.querySelector('#fb-macro');
  console.log("difference in queryselector")
  //console.log(html.querySelector('#fb-macro'))
  //console.log(app.form.querySelector('#fb-macro'))
  //  const fsReactiveExit  = el('#fb-reactive-exit');
  const chkReactiveExit = app.form.querySelector('#fbIsReactiveExit');
  const inpMacroExit = app.form.querySelector('#fbMacroExit');
  app.form.querySelector('#fbIsReactiveExit')?.addEventListener('change', updateStates);

  console.log(chkReactive, inpMacro, chkReactiveExit, inpMacroExit);

  const updateStates = () => {
    // Enable/disable fieldsets by "Is mirror"
    //const mirrorOn = !!chkMirror?.checked;
    //    if (fsReactive)     fsReactive.disabled     = !mirrorOn;
    //    if (fsReactiveExit) fsReactiveExit.disabled = !mirrorOn;

    // Inside each fieldset, toggle macro editability by its checkbox
    if (inpMacro) inpMacro.disabled = !(chkReactive?.checked);
    if (inpMacroExit) inpMacroExit.disabled = !(chkReactiveExit?.checked);
  };

  //chkMirror?.addEventListener('change', updateStates);
  chkReactive?.addEventListener('change', updateStates);
  chkReactiveExit?.addEventListener('change', updateStates);

  // Initial sync (covers first render)
  updateStates();

  app.form.querySelector('footer').insertAdjacentHTML('beforebegin', tabContent);
  app.setPosition({ height: "auto" });
}

// Define defaults
const defaultBeamData = {
  "enabled": false,
  "width": 20,
  "offset": 0,
  "colorHex": "#ffffff",
  "active": false,
  "style": "laser",
  "hasRegion": false,
  "controlHudMode": 0,             // 0 none, 1 color, 2 rotation, 3 both
  "hudDialShadowImg": "",          // optional override
  "hudDialColorImg": "",
  "hudDialRotationImg": "",
  "colors": ["#ffffff"],
  "hudUseActivatorButton": false,
  "hudActivatorOffImg": "",
  "hudActivatorOnImg": "",
  "hudRotationSteps": 12,
  "hudColorStep": 0,
  "hudRotationStep": 0
};


/*
export function beamTokenConfig(app, html, data, opts) {
  //    const beamData = foundry.utils.getProperty(app.token, "flags.foundry-beams.beam") ?? {};
  const storedBeamData = foundry.utils.getProperty(app.token, "flags.foundry-beams.beam") ?? {};
  const beamData = foundry.utils.mergeObject(defaultBeamData, storedBeamData, { inplace: false });

  // ✅ FIX: remove previous injection if TokenConfig re-rendered
  app.form.querySelectorAll('.sheet-tabs a[data-tab="beam"]').forEach(e => e.remove());
  app.form.querySelectorAll('.tab[data-tab="beam"][data-application-part="beam"]').forEach(e => e.remove());

  console.log(app)
  console.log(html)
  if (isDebugActive) console.log(`[${MOD_NAME}] Rendering TokenConfig UI for token: ${app.token.name} with beam data:`, beamData);

  // Add Beam tab button to token config tabs
  app.form.querySelector('.sheet-tabs').insertAdjacentHTML('beforeend', `<a class="item" data-action="tab" data-group="sheet"  data-tab="beam"><i class="fas fa-lightbulb"></i> ${game.i18n.localize("foundry-beams.Beam")}</a>`);
  const options = StyleRegistry.ids().map(id => `<option value="${id}" ${beamData.style === id ? 'selected' : ''}>${id}</option>`).join("");

  // Append custom beam config form elements into the config form
  const dataGroup = game.release.generation < 13 ? "main" : "sheet";
  const tabContent = `
    <div class="tab scrollable" data-group="${dataGroup}" data-tab="beam" data-application-part="beam">
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.EnableBeam")}</label>
        <input type="checkbox" name="flags.foundry-beams.beam.enabled" ${beamData.enabled ? "checked" : ""}/>
      </div>
      <fieldset class="fb-fields" >
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.Active")}</label>
        <input type="checkbox" name="flags.foundry-beams.beam.active" ${beamData.active ? "checked" : ""}/>
      </div>
      <div class="form-group">
        <label title="${game.i18n.localize("foundry-beams.Settings.ControlHudModeTooltip")}">
          ${game.i18n.localize("foundry-beams.Settings.ControlHudMode")}
        </label>
        <select name="flags.foundry-beams.beam.controlHudMode">
          <option value="0" ${Number(beamData.controlHudMode) === 0 ? "selected" : ""}>${game.i18n.localize("foundry-beams.Settings.ControlHudModeNone")}</option>
          <option value="1" ${Number(beamData.controlHudMode) === 1 ? "selected" : ""}>${game.i18n.localize("foundry-beams.Settings.ControlHudModeColor")}</option>
          <option value="2" ${Number(beamData.controlHudMode) === 2 ? "selected" : ""}>${game.i18n.localize("foundry-beams.Settings.ControlHudModeRotation")}</option>
          <option value="3" ${Number(beamData.controlHudMode) === 3 ? "selected" : ""}>${game.i18n.localize("foundry-beams.Settings.ControlHudModeBoth")}</option>
        </select>
      </div>

      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.Settings.HudDialShadowImg")}</label>
        <input type="text" name="flags.foundry-beams.beam.hudDialShadowImg" value="${beamData.hudDialShadowImg ?? ""}" placeholder="modules/.../shadow.webp"/>
      </div>

      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.Settings.HudDialColorImg")}</label>
        <input type="text" name="flags.foundry-beams.beam.hudDialColorImg" value="${beamData.hudDialColorImg ?? ""}" placeholder="modules/.../dial-color.webp"/>
      </div>

      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.Settings.HudDialRotationImg")}</label>
        <input type="text" name="flags.foundry-beams.beam.hudDialRotationImg" value="${beamData.hudDialRotationImg ?? ""}" placeholder="modules/.../dial-rot.webp"/>
      </div>

      <div class="form-group">
        
        <button type="button" id="fb-editColors">
          ${game.i18n.localize("foundry-beams.Settings.EditColors")}
        </button>
        <p class="notes">
          ${game.i18n.localize("foundry-beams.Settings.EditColorsHint")}
        </p>
      </div>
      
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.Settings.HudRotationSteps")}</label>
        <input type="number" min="1" max="360" name="flags.foundry-beams.beam.hudRotationSteps" value="${beamData.hudRotationSteps ?? 12}"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.BeamWidthPx")}</label>
        <input type="number" name="flags.foundry-beams.beam.width" value="${beamData.width ?? 30}" min="1"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.BeamOffsetPx")}</label>
        <input type="number" name="flags.foundry-beams.beam.offset" value="${beamData.offset ?? 30}" min="0"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.BeamColor")}</label>
        <input type="color" name="flags.foundry-beams.beam.colorHex" value="${beamData.colorHex ?? "#ffe699"}"/>
      </div>
      <div class="form-group">
      <label>${game.i18n.localize("foundry-beams.BeamStyle")}</label>
      <select name="flags.foundry-beams.beam.style">${options}</select>
    </div>
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.ActivateRegionOnBeam")}</label>
        <input type="checkbox" name="flags.foundry-beams.beam.hasRegion" ${beamData.hasRegion ? "checked" : ""}/>
      </div>
      <div class="form-group">
        <button id="regionConfigButton" >${game.i18n.localize("foundry-beams.ConfigureRegion")}</button>
      </div>
      </fieldset>
    </div>
  `;

  app.form.querySelector('footer').insertAdjacentHTML('beforebegin', tabContent);
  app.form.querySelector('#regionConfigButton')?.addEventListener('click', () => { regionConfig(app.token) });
  app.form.querySelector("#fb-editColors")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    openBeamColorsEditor(app.token); // you’ll implement this small editor app
  });

}
*/

export function beamTokenConfig(app, html, data, opts) {
  // Use the *current* rendered DOM, not app.form (can be stale across re-renders)
  const root = html?.[0] ?? html;                 // html is usually a jQuery object
  const form = root?.querySelector?.("form") ?? app.form;
  if (!form) return;

  const storedBeamData = foundry.utils.getProperty(app.token, "flags.foundry-beams.beam") ?? {};
  const beamData = foundry.utils.mergeObject(defaultBeamData, storedBeamData, { inplace: false });
  const dataGroup = game.release.generation < 13 ? "main" : "sheet";

  // --- DEDUPE: remove previously injected beam tab + tab panel (idempotent)
  form.querySelectorAll('.sheet-tabs a[data-tab="beam"]').forEach(e => e.remove());
  form.querySelectorAll('.tab[data-tab="beam"][data-application-part="beam"]').forEach(e => e.remove());

  // Find tabs container robustly (V12/V13 changes)
  const tabsEl =
    form.querySelector(".sheet-tabs") ??
    form.querySelector('nav.tabs') ??
    form.querySelector(".tabs");

  if (!tabsEl) {
    console.warn("foundry-beams | TokenConfig tabs container not found; skipping beam injection");
    return;
  }
  const options = StyleRegistry.ids().map(id => `<option value="${id}" ${beamData.style === id ? 'selected' : ''}>${id}</option>`).join("");

  // Insert Beam tab button
  tabsEl.insertAdjacentHTML(
    "beforeend",
    `<a class="item" data-action="tab" data-group="${dataGroup}" data-tab="beam">
       <i class="fas fa-lightbulb"></i> ${game.i18n.localize("foundry-beams.Beam")}
     </a>`
  );

  // Insert tab content
  const tabContent = `
    <div class="tab scrollable" data-group="${dataGroup}" data-tab="beam" data-application-part="beam">
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.EnableBeam")}</label>
        <input type="checkbox" name="flags.foundry-beams.beam.enabled" ${beamData.enabled ? "checked" : ""}/>
      </div>
      <fieldset class="fb-fields" >
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.Active")}</label>
        <input type="checkbox" name="flags.foundry-beams.beam.active" ${beamData.active ? "checked" : ""}/>
      </div>
      <div class="form-group">
        <label title="${game.i18n.localize("foundry-beams.Settings.ControlHudModeTooltip")}">
          ${game.i18n.localize("foundry-beams.Settings.ControlHudMode")}
        </label>
        <select name="flags.foundry-beams.beam.controlHudMode">
          <option value="0" ${Number(beamData.controlHudMode) === 0 ? "selected" : ""}>${game.i18n.localize("foundry-beams.Settings.ControlHudModeNone")}</option>
          <option value="1" ${Number(beamData.controlHudMode) === 1 ? "selected" : ""}>${game.i18n.localize("foundry-beams.Settings.ControlHudModeColor")}</option>
          <option value="2" ${Number(beamData.controlHudMode) === 2 ? "selected" : ""}>${game.i18n.localize("foundry-beams.Settings.ControlHudModeRotation")}</option>
          <option value="3" ${Number(beamData.controlHudMode) === 3 ? "selected" : ""}>${game.i18n.localize("foundry-beams.Settings.ControlHudModeBoth")}</option>
        </select>
      </div>

      <div class="form-group">
        <label title="${game.i18n.localize("foundry-beams.Settings.HudDialShadowImgTooltip")}">${game.i18n.localize("foundry-beams.Settings.HudDialShadowImg")}</label>
        <file-picker id="flags.foundry-beams.beam.hudDialShadowImg" type="image" name="flags.foundry-beams.beam.hudDialShadowImg" value="${beamData.hudDialShadowImg ?? ""}" placeholder="modules/.../shadow.webp"/>
      </div>

      <div class="form-group">
        <label title="${game.i18n.localize("foundry-beams.Settings.HudDialColorImgTooltip")}">${game.i18n.localize("foundry-beams.Settings.HudDialColorImg")}</label>
        <file-picker id="flags.foundry-beams.beam.hudDialColorImg" type="image" name="flags.foundry-beams.beam.hudDialColorImg" value="${beamData.hudDialColorImg ?? ""}" placeholder="modules/.../dial-color.webp"/>
      </div>

      <div class="form-group">
        <label title="${game.i18n.localize("foundry-beams.Settings.HudDialRotationImgTooltip")}">${game.i18n.localize("foundry-beams.Settings.HudDialRotationImg")}</label>
        <file-picker id="flags.foundry-beams.beam.hudDialRotationImg" type="image" name="flags.foundry-beams.beam.hudDialRotationImg" value="${beamData.hudDialRotationImg ?? ""}" placeholder="modules/.../dial-rot.webp"/>
      </div>
       <div class="form-group">
        <label title="${game.i18n.localize("foundry-beams.Settings.HudUseActivatorButtonTooltip")}">${game.i18n.localize("foundry-beams.Settings.HudUseActivatorButton")}</label>
        <input type="checkbox" name="flags.foundry-beams.beam.hudUseActivatorButton" ${beamData.hudUseActivatorButton ? "checked" : ""}/>
      </div>

      <div class="form-group">
        <label title="${game.i18n.localize("foundry-beams.Settings.HudActivatorOffImgTooltip")}">${game.i18n.localize("foundry-beams.Settings.HudActivatorOffImg")}</label>
        <file-picker id="flags.foundry-beams.beam.hudActivatorOffImg" type="image" name="flags.foundry-beams.beam.hudActivatorOffImg" value="${beamData.hudActivatorOffImg ?? ""}" placeholder="modules/.../hud-off.webp"/>
      </div>

      <div class="form-group">
        <label title="${game.i18n.localize("foundry-beams.Settings.HudActivatorOnImgTooltip")}">${game.i18n.localize("foundry-beams.Settings.HudActivatorOnImg")}</label>
        <file-picker id="flags.foundry-beams.beam.hudActivatorOnImg" type="image" name="flags.foundry-beams.beam.hudActivatorOnImg" value="${beamData.hudActivatorOnImg ?? ""}" placeholder="modules/.../hud-on.webp"/>
      </div>

      <div class="form-group">
        <label title="${game.i18n.localize("foundry-beams.Settings.EditColorsTooltip")}">${game.i18n.localize("foundry-beams.Settings.EditColorsLabel")}</label>
        <button type="button" id="fb-editColors">
          ${game.i18n.localize("foundry-beams.Settings.EditColors")}
        </button>
      </div>
      
      <div class="form-group">
        <label title="${game.i18n.localize("foundry-beams.Settings.HudRotationStepsTooltip")}">${game.i18n.localize("foundry-beams.Settings.HudRotationSteps")}</label>
        <input type="number" min="1" max="360" name="flags.foundry-beams.beam.hudRotationSteps" value="${beamData.hudRotationSteps ?? 12}"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.BeamWidthPx")}</label>
        <input type="number" name="flags.foundry-beams.beam.width" value="${beamData.width ?? 30}" min="1"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.BeamOffsetPx")}</label>
        <input type="number" name="flags.foundry-beams.beam.offset" value="${beamData.offset ?? 30}" min="0"/>
      </div>
      <div class="form-group">
        <label title="${game.i18n.localize("foundry-beams.Settings.BeamColorTooltip")}">${game.i18n.localize("foundry-beams.BeamColor")}</label>
        <input type="color" name="flags.foundry-beams.beam.colorHex" value="${beamData.colorHex ?? "#ffe699"}"/>
      </div>
      <div class="form-group">
      <label>${game.i18n.localize("foundry-beams.BeamStyle")}</label>
      <select name="flags.foundry-beams.beam.style">${options}</select>
    </div>
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.ActivateRegionOnBeam")}</label>
        <input type="checkbox" name="flags.foundry-beams.beam.hasRegion" ${beamData.hasRegion ? "checked" : ""}/>
      </div>
      <div class="form-group">
        <button type="button"  id="regionConfigButton" >${game.i18n.localize("foundry-beams.ConfigureRegion")}</button>
      </div>
      </fieldset>
    </div>
  `;

  const footer = form.querySelector("footer");
  if (!footer) {
    console.warn("foundry-beams | TokenConfig footer not found; skipping beam injection");
    return;
  }

  footer.insertAdjacentHTML("beforebegin", tabContent);

  // Wire handlers using `form` (current DOM)
  form.querySelector('#regionConfigButton')?.addEventListener('click', (ev) => {
    ev.preventDefault();
    regionConfig(app.token);
  });
  form.querySelector("#fb-editColors")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    openBeamColorsEditor(app.token); // you’ll implement this small editor app
  });
  try {
    // Rebind tabs so Foundry recognizes the newly injected tab
    app._tabs?.[0]?.bind?.(app.element?.[0] ?? app.form);
  } catch (e) {
    // safe no-op
  }
}


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
