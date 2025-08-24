export function registerBeamSettings() {
    // Setting: debug flag
    game.settings.register("foundry-beams", "maxBounces", {
        name: game.i18n.localize("foundry-beams.Settings.MaxBounces.Name"),
        scope: "world",
        config: true,
        type: Number,
        default: 3,
        range: { min: 0, max: 10, step: 1 },
        requiresReload: true,
        hint: game.i18n.localize("foundry-beams.Settings.MaxBounces.Hint"),
        onChange: val => console.log(`[foundry-beams] maxBounces ${val}`)
    });

    game.settings.register("foundry-beams", "debug", {
        name: game.i18n.localize("foundry-beams.Settings.Debug.Name"),
        scope: "world",
        config: true,
        type: Boolean,
        requiresReload: true,
        default: false,
        onChange: val => console.log(`[foundry-beams] debug ${val ? "ON" : "OFF"}`)
    });

    game.settings.register("foundry-beams", "useProviderStyles", {
        name: game.i18n.localize("foundry-beams.Settings.UseProviderStyles.Name"),
        hint: game.i18n.localize("foundry-beams.Settings.UseProviderStyles.Hint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

}