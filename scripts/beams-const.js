export const MOD_NAME = "foundry-beams";

export let isDebugActive = false;

// set once after settings are registered
export function initDebugFlag() {
  // safe even if called early; defaults to false if settings not ready
  try {
    isDebugActive = game?.settings?.get(MOD_NAME, "debug") === true;
  } catch {
    isDebugActive = false;
  }
}