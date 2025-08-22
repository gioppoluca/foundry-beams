export const MOD_NAME = "foundry-beams";

export const isDebugActive = () =>
  game?.settings?.get(MOD_NAME, "debug") ?? false;