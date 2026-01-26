import { MOD_NAME, isDebugActive } from "./beams-const.js";
import { BeamRegistry, BeamVisualStyle } from "./beamData.js";
import { StyleRegistry } from "./StyleRegistry.js";
import { beamsSocket } from "./module.js";


export { BeamRegistry, BeamVisualStyle }; // expose via module.api
// beams-api.js — API for external control of beam tokens (by token.id only)

import { toggleBeam, updateBeam } from './beamManager.js';


function canUpdateToken(tokenDoc) {
  return game.user.isGM || tokenDoc.isOwner;
}

async function execAsGM(fnName, ...args) {
  if (!beamsSocket) {
    ui.notifications?.error("socketlib not ready/active (or no GM connected).");
    return null;
  }
  return beamsSocket.executeAsGM(fnName, ...args);
}

async function resolveTokenDocByUuid(tokenUuid) {
  const tokenDoc = await fromUuid(tokenUuid);
  if (!tokenDoc) {
    console.warn(`[foundry-beams] Token not found: ${tokenUuid}`);
    return null;
  }
  return tokenDoc;
}

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
export async function updateBeamColorImpl(tokenUuid, colorHex) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return;

  const flag = tokenDoc.getFlag(MOD_NAME, "beam") || {};
  await tokenDoc.setFlag(MOD_NAME, "beam", { ...flag, colorHex });
}

export async function updateBeamColorById(tokenUuid, colorHex) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return;

  if (canUpdateToken(tokenDoc)) return updateBeamColorImpl(tokenUuid, colorHex);
  return execAsGM("updateBeamColorImpl", tokenUuid, colorHex);
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
export async function rotateBeamToImpl(tokenUuid, degrees) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return;

  const flag = tokenDoc.getFlag(MOD_NAME, "beam") || {};
  if (!flag.enabled) return;

  await tokenDoc.update({ rotation: degrees });
}

export async function rotateBeamByIdTo(tokenUuid, degrees) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return;

  if (canUpdateToken(tokenDoc)) return rotateBeamToImpl(tokenUuid, degrees);
  return execAsGM("rotateBeamToImpl", tokenUuid, degrees);
}

export async function rotateBeamOfImpl(tokenUuid, degrees) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return null;

  const flag = tokenDoc.getFlag(MOD_NAME, "beam") || {};
  if (!flag.enabled) return null;

  const newRot = (tokenDoc.rotation + degrees);
  await tokenDoc.update({ rotation: newRot });
  return newRot;
}

export async function rotateBeamByIdOf(tokenUuid, degrees) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return null;

  if (canUpdateToken(tokenDoc)) return rotateBeamOfImpl(tokenUuid, degrees);
  return execAsGM("rotateBeamOfImpl", tokenUuid, degrees);
}


/** Toggle the beam (enable/disable) by token ID */
// pure implementation – NO socketlib routing in here
export async function toggleBeamByIdImpl(tokenId) {
  const token = await resolveValidBeamTokenById(tokenId);
  if (!token) {
    console.warn(`[foundry-beams] Token not found: ${tokenId}`);
    return;
  }

  const flag = token.getFlag(MOD_NAME, "beam") || {};
  const newState = !flag.enabled;
  await toggleBeam(token, newState);
}

// public API is a router.
// It calls the SAME impl locally when allowed, otherwise asks GM.
export async function toggleBeamById(tokenId) {
  const tokenDoc = await fromUuid(tokenId);
  if (!tokenDoc) return;

  // Owner/GM can do it directly
  if (canUpdateToken(tokenDoc)) return toggleBeamByIdImpl(tokenId);

  // Non-owner: ask GM via socketlib
  return execAsGM("toggleBeamByIdImpl", tokenId);
}

/** Activate the beam for a token by ID */
export async function activateBeamImpl(tokenUuid) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (tokenDoc)
    await tokenDoc.setFlag(MOD_NAME, "beam", { active: true });
}

export async function activateBeamById(tokenUuid) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return;

  if (canUpdateToken(tokenDoc)) return activateBeamImpl(tokenUuid);
  return execAsGM("activateBeamImpl", tokenUuid);
}

export async function disactivateBeamImpl(tokenUuid) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (tokenDoc)
    await tokenDoc.setFlag(MOD_NAME, "beam", { active: false });
}

export async function disactivateBeamById(tokenUuid) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return;

  if (canUpdateToken(tokenDoc)) return disactivateBeamImpl(tokenUuid);
  return execAsGM("disactivateBeamImpl", tokenUuid);
}

/** Toggle the beam activation (activate/disactivate) by token ID */
// GM-safe implementation
export async function toggleActivationBeamImpl(tokenUuid) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return;

  const flag = tokenDoc.getFlag(MOD_NAME, "beam") || {};
  const newState = !flag.active;
  await tokenDoc.setFlag(MOD_NAME, "beam", { ...flag, active: newState });
}

// Public API router
export async function toggleActivationBeamById(tokenUuid) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return;

  if (canUpdateToken(tokenDoc)) return toggleActivationBeamImpl(tokenUuid);
  return execAsGM("toggleActivationBeamImpl", tokenUuid);
}

/** Force update beam rendering for a token by ID */
export async function forceUpdateBeamImpl(tokenUuid) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc?.object) return;
  await updateBeam(tokenDoc.object, null, true);
}

export async function forceUpdateBeamById(tokenUuid) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return;

  // forceUpdate is a "world-visible" action; route non-owners via GM
  if (canUpdateToken(tokenDoc)) return forceUpdateBeamImpl(tokenUuid);
  return execAsGM("forceUpdateBeamImpl", tokenUuid);
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

export function registerExternalStyle(style) {
  return StyleRegistry.register(style);
}

export function registerExternalStyles(styles) {
  for (const s of styles) StyleRegistry.register(s);
}


/** Update beam color for a token by ID */
export async function updateHudImpl(tokenUuid, colorHex, rotation, hudColorStep, hudRotationStep) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return;

  const flag = tokenDoc.getFlag(MOD_NAME, "beam") || {};
  console.log("updateHudImpl", { colorHex, rotation, hudColorStep, hudRotationStep });
  await tokenDoc.setFlag(MOD_NAME, "beam", { ...flag, colorHex, hudColorStep, hudRotationStep });
  await tokenDoc.update({ rotation });
}

export async function updateHud(tokenUuid, colorHex, rotation, hudColorStep, hudRotationStep) {
  const tokenDoc = await resolveTokenDocByUuid(tokenUuid);
  if (!tokenDoc) return;

  if (canUpdateToken(tokenDoc)) return updateHudImpl(tokenUuid, colorHex, rotation, hudColorStep, hudRotationStep);
  return execAsGM("updateHudImpl", tokenUuid, colorHex, rotation, hudColorStep, hudRotationStep);
}
