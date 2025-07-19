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
        let anyJitter = false;
        for (const beam of BeamRegistry.values()) {
            for (const seg of beam.segments.values()) {
                if (typeof seg.jitterFn === "function") {
                    anyJitter = true;
                    seg.jitterFn(delta);
                }
            }
        }
        // Optional: if absolutely no segment needed jitter we could early‑return
        // or even stop() the ticker – but a single iteration over a handful of
        // beams is extremely cheap, so we keep it simple.
    }
}

export const beamTicker = new BeamTicker();