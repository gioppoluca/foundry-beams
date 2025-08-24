import { MOD_NAME, isDebugActive } from "./beams-const.js";
import { StyleRegistry } from "./StyleRegistry.js";


export function beamWallConfig(app, html, data) {
  const mirrorData = foundry.utils.getProperty(app.document, "flags.foundry-beams.mirror") ?? {};
  console.log(mirrorData)
  if (isDebugActive) console.log(app);
  //let footer = app.form.querySelector("footer");
  const tabContent = `
    <fieldset class="beam-group" data-tab="beam">
      <legend>${game.i18n.localize("foundry-beams.WallConfigLegend")}</legend>
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.IsMirror")}</label>
        <input type="checkbox" name="flags.foundry-beams.mirror.isMirror" ${mirrorData.isMirror ? "checked" : ""}/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.IsReactive")}</label>
        <input type="checkbox" name="flags.foundry-beams.mirror.isReactive" ${mirrorData.isReactive ? "checked" : ""}/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.MacroForReactive")}</label>
        <input type="string" name="flags.foundry-beams.mirror.macro" value="${mirrorData.macro ?? ""}" />
      </div>
    </fieldset>
  `;

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
  "hasRegion": false
};

export function beamTokenConfig(app, html, data, opts) {
  //    const beamData = foundry.utils.getProperty(app.token, "flags.foundry-beams.beam") ?? {};
  const storedBeamData = foundry.utils.getProperty(app.token, "flags.foundry-beams.beam") ?? {};
  const beamData = foundry.utils.mergeObject(defaultBeamData, storedBeamData, { inplace: false });

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
      <fieldset class="fb-fields" ${beamData.enabled ? "" : "disabled"}>
      <div class="form-group">
        <label>${game.i18n.localize("foundry-beams.Active")}</label>
        <input type="checkbox" name="flags.foundry-beams.beam.active" ${beamData.active ? "checked" : ""}/>
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
