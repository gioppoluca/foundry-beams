//import { PIXI } from "./foundryShim.js";

function buildPoints(len, count) {
    const pts = [0];
    for (let i = 1; i < count; i++) pts.push((i / count) * len);
    return pts;
}
function jitter(pts, rng) { for (let i = 1; i < pts.length - 1; i++) pts[i] += (Math.random() - 0.5) * rng; }
function draw(gfx, pts, col, w) {
    gfx.clear();
    gfx.lineStyle(w, PIXI.utils.string2hex(col));
    gfx.moveTo(0, 0);
    for (const x of pts) gfx.lineTo(x, (Math.random() - 0.5) * 20);
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
};