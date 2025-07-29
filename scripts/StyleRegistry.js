export const StyleRegistry = {
    _map: new Map(),

    /**
     * Register a BeamStyle object: { id, create, update, tick?, destroy? }
     */
    register(style) {
        if (!style?.id) throw new Error("BeamStyle requires a unique id");
        if (this._map.has(style.id)) console.warn(`[foundry‑beams] style '${style.id}' overwritten`);
        this._map.set(style.id, style);
    },

    /** Fetch style or undefined */
    get(id) { 
        console.log(`[foundry‑beams] fetching style '${id}'`);
        console.log(this._map);
        console.log(this._map.get(id));
        return this._map.get(id); },

    /** Array of all registered ids */
    ids() { return [...this._map.keys()]; },
};