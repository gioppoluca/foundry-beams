export function registerBeamSettings() {
    // Setting: debug flag
    game.settings.register("foundry-beams", "maxBounces", {
        name: "Maximum bounces",
        scope: "world",
        config: true,
        type: Number,
        default: 3,
        range: { min: 0, max: 10, step: 1 },
        requiresReload: true,
        hint: "Maximum number of bounces a beam can make before it stops.",
        onChange: val => console.log(`[foundry-beams] maxBounces ${val}`)
    });

    game.settings.register("foundry-beams", "debug", {
        name: "Enable debug logging",
        scope: "world",
        config: true,
        type: Boolean,
        requiresReload: true,
        default: false,
        onChange: val => console.log(`[foundry-beams] debug ${val ? "ON" : "OFF"}`)
    });

    game.settings.register("foundry-beams", "useProviderStyles", {
        name: "Load styles from Styles Hub module",
        hint: "If the 'foundry-beams-styles' module is active, import and register all of its styles.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

}