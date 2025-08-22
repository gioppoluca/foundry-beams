//import { PIXI } from "./foundryShim.js"; // resolves global PIXI in tests

const blurCache = new Map(); // cfg.cacheKey -> BlurFilter
const MOD_NAME = "foundry-beams";

export const laserSeqStyle = {
    id: "laserSeq",

    create(seg, cfg, token) {
        /*
        const cont = new PIXI.Container();
        cont.blendMode = PIXI.BLEND_MODES.ADD;
        cont.zIndex = 9_000;

        const beam = new PIXI.Sprite(PIXI.Texture.WHITE);
        beam.anchor.set(0, 0.5);
        beam.height = cfg.width ?? 30;
        beam.tint = PIXI.utils.string2hex(cfg.colorHex ?? "#ffe699");

        let blur = blurCache.get(cfg.cacheKey ?? seg.id);
        if (!blur) {
            blur = new PIXI.filters.BlurFilter();
            blur.blur = 4;
            blurCache.set(cfg.cacheKey ?? seg.id, blur);
        }
        beam.filters = [blur];

        cont.addChild(beam);
        seg.container = cont;
        this.update(seg, cfg, seg.length); // set pos/rot/len
        return cont;
        */
    },

    update(seg, cfg, len, token) {
        /*
        startEffect(token, segments, PIXI.utils.string2hex(cfg.colorHex ?? "#ffe699"));
        const cont = seg.container;
        const beam = cont.children[0];                     // ← sprite
        const newTint = PIXI.utils.string2hex(cfg.colorHex ?? "#ffe699");
        if (beam.tint !== newTint) beam.tint = newTint;
        const dx = seg.end.x - seg.start.x;
        const dy = seg.end.y - seg.start.y;
        cont.position.set(seg.start.x, seg.start.y);
        cont.rotation = Math.atan2(dy, dx);
        cont.children[0].width = len;

        // Debug markers
        if (cfg.debug) {
            if (!seg.debugStart) {
                seg.debugStart = new PIXI.Graphics().beginFill(0x00ff00).drawCircle(0, 0, 3);
                seg.debugEnd = new PIXI.Graphics().beginFill(0xff0000).drawCircle(0, 0, 3);
                cont.addChild(seg.debugStart, seg.debugEnd);
            }
            seg.debugEnd.position.set(len, 0);
        } else if (seg.debugStart) {
            seg.debugStart.destroy();
            seg.debugEnd.destroy();
            seg.debugStart = seg.debugEnd = undefined;
        }
            */
    },

    async deleteAllSegments(token, beamInst) {
//        if (game.user.isGM) {
            console.log("I'm the GM and I can delete effects");
            await this.stopEffect(token);
  //      }
    },
    async processSegments(segments, cfg, beamInst, token) {
        console.log("Processing segments for laserSeq style", segments, cfg, beamInst, token);
        let retContainers = [];
        console.log("am I the GM?", game.user.isGM);
        console.log("[FOUNDRY_BEAMS] game.user:", game.user);
        if (game.user.isGM) {
            console.log("I'm the GM and I can generate effects");
            await this.stopEffect(token);
            await this.startEffect(token, segments, PIXI.utils.string2hex(cfg.colorHex ?? "#ffe699"));
        }
        return retContainers;
    },


    // Ensure Sequencer is loaded
    assertSequencer() {
        const active = game.modules.get("sequencer")?.active;
        if (!active) {
            ui.notifications?.error("[My Sequencer Toggle] Sequencer module is not active.");
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
    async startEffect(token, segments = [], color = 0xffffff) {
        console.log(`[${MOD_NAME}] Starting effect for token`, token, segments);
        this.assertSequencer();

        const FILE = "modules/foundry-beams/beam.webm"; // <- your asset
        const base = this.effectNameForToken(token);
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
                .atLocation(startPt)     // start
                .stretchTo(endPt, { onlyX: true })        // end (Sequencer will rotate/scale to fit)
                .tint(color)
                .scale({ x: 1.0, y: 0.2 })
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
        await seq.play({ local: false, preload: false });
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
        return await Sequencer.EffectManager.endEffects({ name });
    }
};