import { updateBeam, beams, destroyBeam, createBeam } from "./beamManager.js";
import { MOD_NAME, isDebugActive } from "./beams-const.js";
import { StyleRegistry } from "./StyleRegistry.js";
import { beamTicker } from "./beamTicker.js";

export const updateCache = new Map();


export function beamWallUpdate(wallDoc, updateData, options, userid) {
    // We need to check for each wall update since a change in a wall could alter a beam bounce or block a beam entirely.
    if (!canvas.scene) return;
    console.log("updateWall")
    console.log(wallDoc)
    console.log(updateData)
    // Only respond to walls that have moved
    if (!("c" in updateData) && !("ds" in updateData)) return;
    // Filter and update only beam-enabled tokens
    const beamTokens = canvas.tokens.placeables.filter(t => {
        return t.document.getFlag(MOD_NAME, "beam")?.enabled
    }
    );

    for (const token of beamTokens) {
        console.log(token)
        updateBeam(token, {}, true); // Recompute the beam for each emitter
    }

}


export function beamTokenUpdate(tokenDoc, updateData, options, userid) {
    if (isDebugActive) console.log(`[${MOD_NAME}] Token updated:`, tokenDoc, updateData, options, userid);
    //if (!tokenDoc) return;

    const beamFlags = tokenDoc.getFlag(MOD_NAME, "beam");
    if (isDebugActive) console.log(`[${MOD_NAME}] are there any flags?`, beamFlags);
    if (!beamFlags) {
        if (isDebugActive) console.log(`[${MOD_NAME}] No beam flags found on token: ${tokenDoc.name}`);
        return;
    }
    if (isDebugActive) console.log(`[${MOD_NAME}] this is a beam emitter`, beamFlags);
    const beamExists = beams.has(tokenDoc.id);
    if (isDebugActive) console.log(`[${MOD_NAME}] does a beam already exist for this token?`, beamExists);

    // Handle creating the beam: beam is not in beams cache but the user checked the enabled box
    if (beamFlags?.enabled && !beamExists) {
        if (isDebugActive) console.log(`[${MOD_NAME}] Creating beam after refresh for ${tokenDoc.name}`);
        // create beam wants the token object not the document
        createBeam(tokenDoc.object, beamFlags);
    } else if (!beamFlags?.enabled && beamExists) {
        // here we must delete the beam since the user disabled it
        if (isDebugActive) console.log(`[${MOD_NAME}] Removing beam for ${tokenDoc.name}`);
        destroyBeam(tokenDoc.object);
    } else if (!beamFlags?.enabled && !beamExists) {
        // user disabled the beam and there is no beam, nothing to do
        if (isDebugActive) console.log(`[${MOD_NAME}] Beam is disabled and no beam exists for ${tokenDoc.name}, nothing to do.`);
    } else {
        // Handle updating the beam: beam is in beams cache and the user changed some settings
        if (isDebugActive) console.log(`[${MOD_NAME}] Updating beam for ${tokenDoc.name}`);
        // If the token has moved or rotated, cache the update and let refreshToken do the job
        const moved = "x" in updateData || "y" in updateData || "rotation" in updateData;
        const changedStyle = updateData?.flags?.[MOD_NAME]?.beam?.style !== undefined;
        const changedColor = updateData?.flags?.[MOD_NAME]?.beam?.colorHex !== undefined;
        const changedWidth = updateData?.flags?.[MOD_NAME]?.beam?.width !== undefined;
        const changedOffset = updateData?.flags?.[MOD_NAME]?.beam?.offset !== undefined;
        const changedActive = updateData?.flags?.[MOD_NAME]?.beam?.active !== undefined;
        const configChanged = changedStyle || changedColor || changedWidth || changedOffset || changedActive;
        if (moved) {
            if (isDebugActive) console.log(`[${MOD_NAME}] Caching movement update for ${tokenDoc.name}`);
            updateCache.set(tokenDoc.id, updateData);
        } else if (configChanged) {
            if (changedStyle) {
                // If the style changed, we may need to stop an existing effect
                console.log("Style changed, cleaning up old style segments if needed", beams);
                const beam = beams.get(tokenDoc.id);

                const flagStyle = beam.config?.style;
                const style = StyleRegistry.get(flagStyle);
                style.deleteAllSegments(tokenDoc)
            }
            if (isDebugActive) console.log(`[${MOD_NAME}] Applying beam config update after refresh for ${tokenDoc.name}`);
            updateBeam(tokenDoc.object, updateData);
        } else {
            if (isDebugActive) console.log(`[${MOD_NAME}] No relevant changes for beam on ${tokenDoc.name}, nothing to do.`);
        }

    }
}

export function beamRefreshToken(refreshedToken) {
    if (isDebugActive) console.log(`[${MOD_NAME}] Token refreshed:`, refreshedToken);
    if (!updateCache.has(refreshedToken.id)) return;
    const cachedUpdate = updateCache.get(refreshedToken.id);
    updateCache.delete(refreshedToken.id); // Consume only once per move
    if (isDebugActive) console.log(`[${MOD_NAME}] Applying cached update for ${refreshedToken.name}:`, cachedUpdate);
    updateBeam(refreshedToken, cachedUpdate);
}


export function beamsCanvasReady() {
    if (isDebugActive) console.log(`[${MOD_NAME}] Canvas is ready, restoring beams for tokens with beam enabled...`);
    // All sensors in scene
    beamTicker.start();
    let all_beams = canvas.tokens.placeables.filter((tok) => {
        return tok.document.getFlag(MOD_NAME, "beam");
    });
    if (isDebugActive) console.log(`[${MOD_NAME}] Found ${all_beams.length} tokens with beam flags:`, all_beams);
    for (let t of all_beams) {
        const beamData = t.document.getFlag(MOD_NAME, "beam");
        if (beamData?.enabled) {
            if (isDebugActive) console.log(`[${MOD_NAME}] Restoring beam for token: ${t.name}`, beamData);
            createBeam(t, beamData);
        } else {
            if (isDebugActive) console.log(`[${MOD_NAME}] Beam is not enabled for token: ${t.name}, skipping.`);
        }
    }
}