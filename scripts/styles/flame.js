// styles/flame.js – scrolling, flickering wall of fire (top‑down)

// ---------------------------------------------------------------------
// 1.  Put flame-strip.png in modules/<your‑module‑id>/assets/
// 2.  Adjust TEX_PATH below to match your module ID.
// 3.  In module.js (init hook) run:  StyleRegistry.register(flameStyle);
// ---------------------------------------------------------------------

const TEX_PATH = "modules/foundry-beams/assets/flame-strip.png"; // ← change id if needed
const SCROLL_SPEED_PX = 0.8;   // upward pixels per frame
//const FLICKER_STRENGTH  = 0.009;  // colour pulse amplitude 0‑0.3
const DEFAULT_THICKNESS = 40;    // beam thickness if cfg.width missing
const SCROLL_SPEED = 1.2;   // texture scroll speed (pixels per frame)
const FLICKER_STRENGTH = 0.08; // colour pulse intensity 0‑0.3
const NOISE_PATH = "modules/foundry-beams/assets/flame-noise.png";

const flameFrag = /* glsl */`
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uAmp;
uniform float uScale;

float noise(vec2 p) {
  return fract(sin(dot(p, vec2(113.1, 37.7))) * 43758.5453);
}

void main() {
  vec2 uv = vTextureCoord;
  float n  = noise(vec2(uv.x * uScale, uv.y * 3.0 + uTime));
  uv.y    += (n - 0.5) * uAmp;         // vertical warp
  uv.x    += (sin(uv.y * 10.0 + uTime) * 0.01); // shimmer sideways
  gl_FragColor = texture2D(uSampler, uv);
}
`;

const filter = new PIXI.Filter(undefined, flameFrag, {
    uTime: 0,
    uAmp: 0.15,        // warp amplitude
    uScale: 4.0
});

export const flameStyle = {
    id: "flame",

    /* ---------- build visuals ------------------------------------------------ */
    create(seg, cfg) {
        // load the PNG once; PIXI automatically re‑uses cached textures
        const tex = PIXI.Texture.from(TEX_PATH);
        tex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;

        // sprite will be resized in update()
        const ts = new PIXI.TilingSprite(tex, 10, 10);
        ts.anchor.set(0, 0.5);
        ts.tint = PIXI.utils.string2hex(cfg.colorHex ?? "#ffffff");
        let blur = new PIXI.filters.BlurFilter();
        // small colour flicker (ColorMatrix is very cheap)
        const cm = new PIXI.filters.ColorMatrixFilter();
        //ts.filters = [cm,filter];
        ts.filters = [blur, cm];

        const cont = new PIXI.Container();
        cont.blendMode = PIXI.BLEND_MODES.ADD;
        cont.zIndex = 9_003;
        cont.addChild(ts);


        // create a displacement sprite the same size as flame strip
        const dispTex = PIXI.Texture.from(NOISE_PATH);
        dispTex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;

        const dispSprite = new PIXI.TilingSprite(dispTex, 64, 64);
        dispSprite.visible = false;                // we don’t want to see it
        cont.addChild(dispSprite);                 // must be on stage for filter

        const disp = new PIXI.filters.DisplacementFilter(dispSprite, 15); // 12 px amplitude
        ts.filters.push(disp);                 // add after ColorMatrix

        /* per‑frame animation ---------------------------------------------- */
        seg.tick = (dt) => {
            ts.tilePosition.x += dt * SCROLL_SPEED;
            //filter.uniforms.uTime += dt * 0.0005;
            dispSprite.tilePosition.x += dt * 0.8;          // horizontal noise drift
            dispSprite.tilePosition.y += dt * 0.8;

            // hue flicker using a sine wave
            const flick = Math.sin(Date.now() * 0.008) * FLICKER_STRENGTH;
            cm.matrix = [
                1 + flick, 0, 0, 0, 0,
                0, 1 + flick, 0, 0, 0,
                0, 0, 1, 0, 0,
                0, 0, 0, 1, 0
            ];
        };

        seg.container = cont;
        seg.sprite = ts;

        this.update(seg, cfg, seg.length);          // initial orientation & size
        return cont;
    },

    /* ---------- respond to geometry changes ---------------------------------- */
    update(seg, cfg, len) {
        const s = seg.sprite;
        if (!s) return;                             // texture still loading

        s.width = len;                             // match segment length
        s.height = cfg.width ?? 40;                 // beam thickness

        const dx = seg.end.x - seg.start.x;
        const dy = seg.end.y - seg.start.y;
        seg.container.position.set(seg.start.x, seg.start.y);
        seg.container.rotation = Math.atan2(dy, dx);
    },

    destroy(seg) { seg.tick = undefined; }
};
