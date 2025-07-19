import { isDebugActive } from "./module.js";
import { MOD_NAME } from "./beams-const.js";
import { BeamRegistry, BeamVisualStyle } from "./beamData.js";

export { BeamRegistry, BeamVisualStyle }; // expose via module.api
// beams-api.js — API for external control of beam tokens (by token.id only)

import { toggleBeam, updateBeam } from './beamManager.js';

/** Enable a beam for a token by ID */
export async function enableBeamById(tokenId) {
  const token = await resolveValidBeamTokenById(tokenId);
  if (token) await toggleBeam(token, true);
}

/** Disable a beam for a token by ID */
export async function disableBeamById(tokenId) {
  const token = await resolveValidBeamTokenById(tokenId);
  if (token) await toggleBeam(token, false);
}

/** Update beam color for a token by ID */
export async function updateBeamColorById(tokenId, colorHex) {
  const token = await resolveValidBeamTokenById(tokenId);
  if (!token) return;

  const flag = token.getFlag(MOD_NAME, "beam") || {};
  flag.colorHex = colorHex;
  await token.setFlag(MOD_NAME, "beam", flag);

  if (flag.enabled) updateBeam(token);
}

/** Get beam state (enabled + color) by token ID */
export async function getBeamStateById(tokenId) {
  const token = await resolveValidBeamTokenById(tokenId);
  if (!token) return null;
  const flag = token.getFlag(MOD_NAME, "beam") || {};
  return {
    enabled: !!flag.enabled,
    colorHex: flag.colorHex || "#ffe699"
  };
}

/** Rotate the beam by setting the token's rotation */
export async function rotateBeamByIdTo(tokenId, degrees) {
  const token = await resolveValidBeamTokenById(tokenId);
  if (!token) return;
  const flag = token.getFlag(MOD_NAME, "beam") || {};
  //  await token.update({ rotation: degrees });
  if (flag.enabled) {
    await token.update({ rotation: degrees });
    //  updateBeam(token);
  }
}

/** Rotate the beam by setting the token's rotation */
export async function rotateBeamByIdOf(tokenId, degrees) {
  console.log("rotateBeamByIdOf")
  console.log(tokenId)
  const token = await resolveValidBeamTokenById(tokenId);
  console.log(token)
  if (!token) return null;
  const flag = token.getFlag(MOD_NAME, "beam") || {};
  console.log(flag)
  //  await token.update({ rotation: degrees });
  if (flag.enabled) {
    await token.update({ rotation: token.rotation + degrees });
    return token.rotation + degrees;
    //  updateBeam(token);
  }
  return null;
}

/** Toggle the beam (enable/disable) by token ID */
export async function toggleBeamById(tokenId) {
  const token = await resolveValidBeamTokenById(tokenId);
  if (!token) return;

  const flag = token.getFlag(MOD_NAME, "beam") || {};
  const newState = !flag.enabled;

  //  await token.setFlag(MOD_NAME, "beam", { ...flag, enabled: newState });

  await toggleBeam(token, newState);
}


/**
 * Resolves token instance from ID and ensures it has beam configuration
 * @param {string} tokenId
 * @returns {Token|null}
 */
async function resolveValidBeamTokenById(tokenId) {
  const token = await fromUuid(tokenId);
  if (isDebugActive) console.log(token);
  if (!token) {
    console.warn(`[foundry-beams] Token not found on canvas: ${tokenId}`);
    return null;
  }
  const flag = token.getFlag(MOD_NAME, "beam");
  if (!flag) {
    console.warn(`[foundry-beams] Token ${token.name} does not have beam flags configured.`);
    return null;
  }
  return token;
}

/**
 * Change beam visual style on the fly.
 * @param {Token} token
 * @param {keyof typeof BeamVisualStyle} style
 */
export function setBeamStyle(token, style) {
  console.log(token)
  const inst = BeamRegistry.get(token.id);
  if (inst) inst.style = BeamVisualStyle[style] ?? BeamVisualStyle.LASER;
}