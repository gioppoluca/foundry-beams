/**
 * Beam visual styles (per‑beam) – not per segment.
 * Extend as we add more renderers.
 */
export const BeamVisualStyle = Object.freeze({
    LASER: "laser",      // default basic glow filter
    LIGHTNING: "lightning",  // GSAP jagged bolt
});

/**
 * @typedef {{x:number,y:number}} Point
 * @typedef {{
 *   id: string,
 *   start: Point,
 *   end: Point,
 *   normal: [number, number],
 *   length: number,
 *   container?: PIXI.Container,
 *   filter?: PIXI.Filter
 * }} BeamSegment
 */

/**
 * Holds all runtime state for one token‑emitted beam.
 */
export class BeamInstance {
    /**
     * @param {string} tokenId                      – Token.document.id
     * @param {object} config                       – Original beam flag/config
     * @param {string} [style=BeamVisualStyle.LASER] – Visual style
     */
    constructor(tokenId, config = {}, style = BeamVisualStyle.LASER) {
    /** @readonly */ this.tokenId = tokenId;
    /** User‑configurable appearance/physics */ this.config = config;
    /** e.g. "laser" | "lightning" */          this.style = style;
    /** @type {Map<string, BeamSegment>} */      this.segments = new Map();
    }

    /** Destroy PIXI containers & wipe segment map */
    clear() {
        for (const seg of this.segments.values()) seg.container?.destroy({ children: true });
        this.segments.clear();
    }
}

/**
 * Central registry (tokenId → BeamInstance)
 */
export const BeamRegistry = {
    /** @type {Map<string, BeamInstance>} */
    _map: new Map(),

    /** Ensure and return instance for token. */
    ensure(token, config = {}, style = BeamVisualStyle.LASER) {
        let inst = this._map.get(token.id);
        if (!inst) {
            inst = new BeamInstance(token.id, config, style);
            this._map.set(token.id, inst);
        } else {
            // keep latest config/style fresh
            inst.config = { ...inst.config, ...config };
            if (style) inst.style = style;
        }
        return inst;
    },

    /** Get instance or undefined */
    get(tokenId) { return this._map.get(tokenId); },

    /** Destroy & forget */
    delete(tokenId) {
        const inst = this._map.get(tokenId);
        if (inst) inst.clear();
        this._map.delete(tokenId);
    },

    /** Iterate */
    values() { return this._map.values(); },


};

// --- Phase 2 helpers ---------------------------------------------------------

/**
 * Ensure a segment with `id` exists on `beamInst`. Creates a bare template –
 * the caller is responsible for filling geometry and attaching PIXI things.
 * @param {BeamInstance} beamInst
 * @param {string} id
 * @returns {import("./beamData.js").BeamSegment}
 */
export function ensureSegment(beamInst, id) {
    let seg = beamInst.segments.get(id);
    if (!seg) {
        seg = { id, start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, normal: [0, 0], length: 0 };
        beamInst.segments.set(id, seg);
    }
    return seg;
}