// foundry-beams / StyleManager.js
import { StyleRegistry } from "./StyleRegistry.js";

/**
 * Load built‑in styles that ship with the module. Call once from init.
 */
export async function loadBuiltIn() {
  const { laserStyle } = await import("./styles/laser.js");
  const { lightningStyle } = await import("./styles/lightning.js");
  console.log("[foundry-beams] loading built-in styles");
  StyleRegistry.register(laserStyle);
  StyleRegistry.register(lightningStyle);
}

/**
 * Scan foundry-beams/custom-styles/** /index.js and register each.
 * Works client‑side with FilePicker.browse, so it runs for every GM and player;
 * only the GM needs write access when new zips are uploaded.
 */
export async function loadCustomStyles() {
  const ROOT = "foundry-beams/custom-styles";
  console.log(`[foundry-beams] loading custom styles from ${ROOT}`);
  const req = await FilePicker.browse("data", ROOT);
  for (const dir of req.dirs) {
    try {
      const id = dir.split("/").pop();
      const entryPath = `${dir}/index.js`;
      const url = `/${entryPath}?v=${Date.now()}`;     // absolute path
      const mod = await import(/* @vite-ignore */ url);
      const styleObj = mod.default ?? mod[id] ?? mod[Object.keys(mod)[0]];
      StyleRegistry.register(styleObj);
      console.log(`[foundry-beams] custom style '${id}' loaded`);
    } catch (err) {
      console.warn(`[foundry-beams] failed to load style from ${dir}`, err);
    }
  }
}
