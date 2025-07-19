import { BeamRegistry, BeamVisualStyle } from "./beamData.js";

class BeamTicker {
    constructor() {
        this._boundUpdate = this._update.bind(this);
        this._running = false;
    }

    start() {
        if (this._running) return;
        PIXI.Ticker.shared.add(this._boundUpdate);
        this._running = true;
    }

    stop() {
        if (!this._running) return;
        PIXI.Ticker.shared.remove(this._boundUpdate);
        this._running = false;
    }

    /** Called each RAF */
    _update(delta) {
        for (const beam of BeamRegistry.values()) {
            for (const seg of beam.segments.values()) {
                (seg.tick ?? seg.jitterFn)?.(delta);   // ← works with old or new field
            }
        }
    }
}

export const beamTicker = new BeamTicker();