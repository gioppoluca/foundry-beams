// foundry-beams-api-refactored.js — API for external control of beam tokens (by token.id only)

import { toggleBeam, updateBeam } from './beamManager.js';

/** Enable a beam for a token by ID */
export async function enableBeamById(tokenId) {
  const token = resolveValidBeamTokenById(tokenId);
  if (token) await toggleBeam(token, true);
}

/** Disable a beam for a token by ID */
export async function disableBeamById(tokenId) {
  const token = resolveValidBeamTokenById(tokenId);
  if (token) await toggleBeam(token, false);
}

/** Update beam color for a token by ID */
export async function updateBeamColorById(tokenId, colorHex) {
  const token = resolveValidBeamTokenById(tokenId);
  if (!token) return;

  const flag = token.getFlag("foundry-beams", "beam") || {};
  flag.colorHex = colorHex;
  await token.setFlag("foundry-beams", "beam", flag);

  if (flag.enabled) updateBeam(token);
}

/** Get beam state (enabled + color) by token ID */
export function getBeamStateById(tokenId) {
  const token = resolveValidBeamTokenById(tokenId);
  if (!token) return null;
  const flag = token.getFlag("foundry-beams", "beam") || {};
  return {
    enabled: !!flag.enabled,
    colorHex: flag.colorHex || "#ffe699"
  };
}

/** Rotate the beam by setting the token's rotation */
export async function rotateBeamById(tokenId, degrees) {
  const token = resolveValidBeamTokenById(tokenId);
  if (!token) return;
  await token.document.update({ rotation: degrees });
  const flag = token.getFlag("foundry-beams", "beam") || {};
  if (flag.enabled) updateBeam(token);
}

/**
 * Resolves token instance from ID and ensures it has beam configuration
 * @param {string} tokenId
 * @returns {Token|null}
 */
function resolveValidBeamTokenById(tokenId) {
  const token = canvas.tokens.get(tokenId);
  console.log(token);
  if (!token) {
    console.warn(`[foundry-beams] Token not found on canvas: ${tokenId}`);
    return null;
  }
  const flag = token.document.getFlag("foundry-beams", "beam");
  if (!flag) {
    console.warn(`[foundry-beams] Token ${token.name} does not have beam flags configured.`);
    return null;
  }
  return token.document;
}
