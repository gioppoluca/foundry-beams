//import { PIXI } from "./foundryShim.js"; // resolves global PIXI in tests
//import { ensureSegment } from "./beamData.js";
const blurCache = new Map(); // cfg.cacheKey -> BlurFilter

export const laserStyle = {
    id: "laser",

    create(seg, cfg) {
        console.log("Style LASER - CREATE")
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
    },

    update(seg, cfg, len) {
        console.log("Style LASER - UPDATE")
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
    },

    deleteAllSegments(token, beamInst) {
        // in this case nothing to do
    },
    
    processSegments(segments, cfg, beamInst, token) {
        let retContainers = [];
        console.log("Style LASER - PROCESS SEGMENTS")
        for (let i = 0; i < segments.length; i++) {
            const segData = segments[i];
            const segId = String(i);

            // Re‑use or create BeamSegment shell
            const seg = this.ensureSegment(beamInst, segId);
            console.log("Segment:", seg)
            console.log("Segment:", segData)
            //const seg = {}

            // --- Update geometry data (point calc unchanged) -----------------------
            seg.start = segData.start;
            /*
            seg.end = segData.end ?? {
                x: segData.start.x + (segData.dx ?? 0),
                y: segData.start.y + (segData.dy ?? 0)
            };
            */
            seg.end = segData.end;
            seg.normal = segData.normal;
            seg.length = segData.length;
            const len = seg.length;  // <- add this
            console.log("Segment after:", seg)
            // --- Update visuals (rotation / length) --------------------------------
            if (!seg.container) {
                seg.container = this.create(seg, cfg);
                canvas.effects.addChild(seg.container);

                // keep shader‑ticker compatible
                retContainers.push({ container: seg.container, filter: seg.container.filter });
            } else {
                this.update(seg, cfg, len);
            }
        }
        return retContainers;
    },

    ensureSegment(beamInst, id) {
        let seg = beamInst.segments.get(id);
        if (!seg) {
            seg = { id, start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, normal: [0, 0], length: 0 };
            beamInst.segments.set(id, seg);
        }
        return seg;
    }
};