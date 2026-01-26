// scripts/hud-colors-editor-app.js
import { MOD_NAME } from "./beams-const.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Open the colors editor for a Token (or TokenDocument).
 * Persists to flags.<MOD_NAME>.beam.colors ONLY when Save is pressed.
 *
 * @param {Token|TokenDocument} token
 * @param {{ onSave?: (colors: string[]) => void }} [options]
 */
export function openBeamColorsEditor(token, options = {}) {
    if (!token) return;
    const doc = token.document ?? token;
    new BeamColorsEditorApp({ tokenDoc: doc, onSave: options.onSave }).render(true);
}

class BeamColorsEditorApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: "foundry-beams-colors-editor",
        window: { title: "Beam Colors", resizable: true },
        position: { width: 520, height: "auto" },
    });

    static PARTS = {
        main: {
            id: "main",
            template: `modules/${MOD_NAME}/templates/hud/beam-colors-editor.hbs`,
        },
    };

    /**
     * @param {{tokenDoc: TokenDocument, onSave?: (colors: string[]) => void}} param0
     */
    constructor({ tokenDoc, onSave } = {}) {
        super();
        this.tokenDoc = tokenDoc;
        this.onSave = typeof onSave === "function" ? onSave : null;

        // Draft is mutable; we persist only on Save
        const beam = this.tokenDoc?.getFlag?.(MOD_NAME, "beam") ?? {};
        const initial = Array.isArray(beam.colors) ? beam.colors : [];
        this.colorsDraft = initial.length ? [...initial] : ["#ffffff"];
    }

    async _prepareContext(_options) {
        return {
            colors: this.colorsDraft.map((c, i) => ({
                index: i,
                value: normalizeHex(c) ?? "#ffffff",
            })),
            count: this.colorsDraft.length,
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const root = this.element?.root ?? this.element;
        if (!root) return;

        // + Add
        root.querySelector('[data-action="add"]')?.addEventListener("click", (ev) => {
            ev.preventDefault();
            this.colorsDraft.push("#ffffff");
            this.render(false);
        });

        // Delete per row
        root.querySelectorAll('[data-action="delete"]').forEach((btn) => {
            btn.addEventListener("click", (ev) => {
                ev.preventDefault();
                const index = Number(ev.currentTarget.dataset.index);
                if (!Number.isInteger(index)) return;
                this.colorsDraft.splice(index, 1);

                // Keep at least one color (simplifies dial logic)
                if (this.colorsDraft.length === 0) this.colorsDraft.push("#ffffff");

                this.render(false);
            });
        });

        // Live-update draft when a color changes (still not persisted)
        // <color-picker> exposes .value like an input.
        root.querySelectorAll("color-picker[data-index]").forEach((el) => {
            const handler = () => {
                const index = Number(el.dataset.index);
                if (!Number.isInteger(index)) return;
                const v = normalizeHex(el.value) ?? "#ffffff";
                this.colorsDraft[index] = v;

                // Update the readout span next to it without rerendering
                const row = root.querySelector(`.fb-color-row[data-index="${index}"]`);
                row?.querySelector("[data-role='hex']")?.replaceChildren(v);
            };

            el.addEventListener("change", handler);
            el.addEventListener("input", handler);
        });

        // Save
        root.querySelector('[data-action="save"]')?.addEventListener("click", async (ev) => {
            ev.preventDefault();
            await this._persistAndClose();
        });

        // Cancel
        root.querySelector('[data-action="cancel"]')?.addEventListener("click", (ev) => {
            ev.preventDefault();
            this.close();
        });
    }

    async _persistAndClose() {
        if (!this.tokenDoc?.setFlag) return;

        // Normalize + de-dup trivial invalids
        let colors = (this.colorsDraft ?? [])
            .map((c) => normalizeHex(c))
            .filter((c) => typeof c === "string" && c.length);

        if (!colors.length) colors = ["#ffffff"];

        const beam = this.tokenDoc.getFlag(MOD_NAME, "beam") ?? {};
        const next = foundry.utils.deepClone(beam);

        next.colors = colors;

        // Clamp step + align current colorHex (nice UX)
        //const step = clampInt(next.hudColorStep, 0, colors.length - 1, 0);
        //next.hudColorStep = step;

        await this.tokenDoc.setFlag(MOD_NAME, "beam", next);

        // notify settings UI if caller wants to update readonly field
        try {
            this.onSave?.(colors);
        } catch (e) {
            console.warn(`${MOD_NAME} | onSave callback failed`, e);
        }

        this.close();
    }
}

function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const i = Math.floor(n);
    return Math.max(min, Math.min(max, i));
}

/**
 * Normalize hex like "#RRGGBB" (no alpha).
 * Returns null if invalid.
 */
function normalizeHex(v) {
    if (typeof v !== "string") return null;
    const s = v.trim();
    const m = /^#?[0-9a-fA-F]{6}$/.exec(s);
    if (!m) return null;
    return s.startsWith("#") ? s.toLowerCase() : `#${s.toLowerCase()}`;
}
