//import { PIXI } from "./foundryShim.js";

/* ---------- helpers ---------------------------------------------------- */
function buildPoints(len, count) {
  // 0 .. len, inclusive, so the last vertex is exactly at beam end
  const pts = [];
  for (let i = 0; i <= count; i++) pts.push((i / count) * len);
  return pts;
}

/* jitter *only* interior vertices (skip index 0 and last) */
function jitter(pts, rng) {
  for (let i = 1; i < pts.length - 1; i++) {
    pts[i] += (Math.random() - 0.5) * rng;
  }
}

/* redraw the bolt */
function draw(gfx, pts, col, w) {
  const amp = 20;                                         // vertical swing
  gfx.clear();
  gfx.lineStyle(w, PIXI.utils.string2hex(col));
  gfx.moveTo(0, 0);
  for (let i = 1; i < pts.length; i++) {
    gfx.lineTo(pts[i], (Math.random() - 0.5) * amp);
  }
}


export const lightningStyle = {
    id: "lightning",

    create(seg, cfg) {
        const cont = new PIXI.Container();
        cont.blendMode = PIXI.BLEND_MODES.ADD;
        cont.zIndex = 9_001;

        const gfx = new PIXI.Graphics();
        cont.addChild(gfx);
        seg.points = buildPoints(seg.length, cfg.segments ?? 20);
        draw(gfx, seg.points, cfg.colorHex ?? "#a7d5f9", cfg.width ?? 5);

        // store tick so ticker can call without style lookup
        seg.tick = (delta) => {
            //            jitter(seg.points, 4);
            //          draw(gfx, seg.points, cfg.colorHex ?? "#a7d5f9", cfg.width ?? 5);
            const g = seg.container?.children[0];
            if (!g) return;                   // container was destroyed
            jitter(seg.points, 4);
            draw(g, seg.points, cfg.colorHex ?? "#a7d5f9", cfg.width ?? 5);
        };
        seg.container = cont;
        this.update(seg, cfg, seg.length);

        return cont;
    },

    update(seg, cfg, len) {
        const cont = seg.container;
        const dx = seg.end.x - seg.start.x;
        const dy = seg.end.y - seg.start.y;
        cont.position.set(seg.start.x, seg.start.y);
        cont.rotation = Math.atan2(dy, dx);
        // rebuild points if length changed
        if (seg.prevLen !== len) {
            seg.prevLen = len;
            seg.points = buildPoints(len, cfg.segments ?? 20);
        }
        const gfx = seg.container.children[0];
        const newColor = cfg.colorHex ?? "#a7d5f9";
        if (seg.prevColor !== newColor) {
            seg.prevColor = newColor;
            draw(gfx, seg.points, newColor, cfg.width ?? 5);
            seg.tick = () => {                             // ALWAYS reset tick
                const g = seg.container?.children[0];
                if (!g) return;
                jitter(seg.points, 4);
                draw(g, seg.points, newColor, cfg.width ?? 5);
            };
        }
    },

    destroy(seg) { seg.tick = undefined; },

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