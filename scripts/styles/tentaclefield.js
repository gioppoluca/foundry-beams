//import { PIXI } from "./foundryShim.js"; // resolves global PIXI in tests

const blurCache = new Map(); // cfg.cacheKey -> BlurFilter
const MOD_NAME = "foundry-beams";

export const tentaclefieldStyle = {
    id: "tentaclefield",

    create(seg, cfg, token) {
    },

    update(seg, cfg, len, token) {
    },

    async deleteAllSegments(token, beamInst) {
        await this.stopEffect(token);
    },
    async processSegments(segments, cfg, beamInst, token) {
        console.log("Processing segments for tentaclefield style", segments, cfg, beamInst, token);
        let retContainers = [];
        console.log("am I the GM?", game.user.isGM);
        console.log("[FOUNDRY_BEAMS] game.user:", game.user);
        if (game.user.isGM) {
            console.log("I'm the GM and I can generate effects");
            let stopped = await this.stopEffect(token);
            console.log(`[${MOD_NAME}]stopped`,stopped)
            let started = await this.startEffect(token, segments, PIXI.utils.string2hex(cfg.colorHex ?? "#ffe699"), cfg.width);
            console.log(`[${MOD_NAME}]started`,started)
        }
        return retContainers;
    },


    // Ensure Sequencer is loaded
    assertSequencer() {
        const active = game.modules.get("sequencer")?.active;
        if (!active) {
            ui.notifications?.error(game.i18n.localize("foundry-beams.error.SequencerNotActive"));
            throw new Error("Sequencer not active");
        }
    },

    // A stable effect name per-token so we can query/stop it later
    effectNameForToken(token) {
        return `${MOD_NAME}-${token.document?.name ?? token.name}`;
    },

    // Is our effect already running on this token?
    isEffectActive(token) {
        try {
            this.assertSequencer();
            const name = this.effectNameForToken(token);
            const effects = Sequencer.EffectManager.getEffects({ name, object: token?.object ?? token });
            return (effects?.length ?? 0) > 0;
        } catch {
            return false;
        }
    },


    /**
     * Start effect(s).
     * - If no segments provided => single attached effect (old behavior).
     * - If segments provided => one effect per segment in a single Sequence.
     *
     * @param {Token|TokenDocument|PlaceableObject} token
     * @param {Array<{start:{x:number,y:number}, end:{x:number,y:number}}>} [segments]
     */
    async startEffect(token, segments = [], color = 0xffffff, width = 10) {
        console.log(`[${MOD_NAME}] Starting effect for token`, token, segments);
        this.assertSequencer();

        const FILE = `${MOD_NAME}.walls.tentacles`;
        const base = this.effectNameForToken(token);
        const scaleY = (width * 0.01); // base asset is 100px high
        console.log(`[${MOD_NAME}] Effect base name: ${base}`);
        // No segments? default to a single attached effect.

        // Build one Sequence with 1 effect per segment
        const seq = new Sequence();
        segments.forEach((seg, i) => {
            const randomFourDigit = Math.floor(1000 + Math.random() * 9000);
            console.log(randomFourDigit);
            const name = `${base}-${i}-${randomFourDigit}`;
            const start = seg?.start ?? {};
            const end = seg?.end ?? {};
            const startPt = { x: start.x, y: start.y };
            const endPt = { x: end.x, y: end.y };

            // If your asset supports stretching (e.g., beams), .stretchTo will scale/rotate it.
            seq.effect()
                .name(name)
                .file(FILE)
                .volume(0.0)
                .atLocation(startPt)     // start
                .stretchTo(endPt, { onlyX: true })        // end (Sequencer will rotate/scale to fit)
                .tint(color)
              //  .scale({ x: 1.0, y: scaleY })
                .filter("Glow", {
                    distance: 15,      // Number, distance of the glow in pixels
                    outerStrength: 3,  // Number, strength of the glow outward from the edge of the sprite
                    innerStrength: 0,  // Number, strength of the glow inward from the edge of the sprite
                    color: color,   // Hexadecimal, color of the glow
                    quality: 0.07,      // Number, describes the quality of the glow (0 to 1) - the higher the number the less performant
                    knockout: false    // Boolean, toggle to hide the contents and only show glow (effectively hides the sprite)
                })
                .persist(true, { "persistTokenPrototype": true })
                .belowTokens(false)
        });
        console.log(`[${MOD_NAME}] Playing sequence with ${segments.length} segments`);

        //await seq.play({ local: true, preload: true });
        return await seq.play({ local: false, preload: false });
    },

    /**
     * Stop effect(s). If segments are provided, it tries to stop the indexed names.
     * If not, it stops any effect whose name starts with the base.
     *
     * @param {Token|TokenDocument|PlaceableObject} token
     * @param {Array} [segments]
     */
    async stopEffect(token) {
        this.assertSequencer();
        console.log(`[${MOD_NAME}] Stopping effect for token`, token);
        const base = this.effectNameForToken(token);

        const name = `${base}-*`;
        console.log(`[${MOD_NAME}] Ending effects with name: ${name}`);
        return await Sequencer.EffectManager.endEffects({ name: name });
    }
};