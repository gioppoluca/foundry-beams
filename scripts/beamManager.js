import { MOD_NAME, isDebugActive } from "./beams-const.js";
import { reactiveMacro } from './beams-macro.js';
import { createRegionFromSegments, deleteBeamRegions, disableRegion, enableRegion } from './beams-region.js';
import { getTokensAlongSegment } from "./beams-util.js";
import { BeamRegistry, BeamVisualStyle, ensureSegment } from "./beamData.js";
import { StyleRegistry } from "./StyleRegistry.js";

export const beams = new Map(); // token.id -> { containers[], config }

const laserBlurCache = new Map(); // tokenId -> BlurFilter
// TODO we need to save the current style since we do not have the previous flag style in the updateToken hook
// but potentially each style need to be able to destroy the previous beam with its own ways
const currentBeamStyle = "laser"; // Default style, can be overridden by user settings  

/*
let shaderTickerRegistered = false;
function startShaderAnimation() {
    if (shaderTickerRegistered) return;
    if (isDebugActive) console.log("[foundry-beams] Starting shader ticker");
    canvas.app.ticker.add((delta) => {
        for (const beam of beams.values()) {
            for (const segment of beam.containers) {
                const filter = segment.filter;
                if (filter?.uniforms?.time !== undefined) filter.uniforms.time += delta * 0.05;
            }
        }
    });
    shaderTickerRegistered = true;
}
*/

export async function toggleBeam(token, forceEnable = null) {
    console.log(token)
    const flag = token.getFlag(MOD_NAME, "beam") || {};
    const isEnabled = forceEnable !== null ? forceEnable : !flag.enabled;
    if (isDebugActive) console.log(`[foundry-beams] toggleBeam for ${token.name}: ${isEnabled}`);

    if (isEnabled) {
        // we need to pass the token and not the TokenDocument
        await createBeam(token.object, flag);
    } else {
        destroyBeam(token.object);
    }

    // await token.document.setFlag(MOD_NAME, "beam", { ...flag, enabled: isEnabled });
    await token.setFlag(MOD_NAME, "beam", { ...flag, enabled: isEnabled });
}

export function createBeam(token, config = {}) {
    if (isDebugActive) console.log(`[foundry-beams] Creating beam for ${token.name}`);
    beams.set(token.id, { containers: [], config });

    // Phase 1: initialise new BeamRegistry (style will be added via flags later)
    const flagStyle = token.document.getFlag("foundry-beams", "beam")?.style ?? "laser";
    console.log("Flag style:", flagStyle)
    console.log(flagStyle)
    BeamRegistry.ensure(token, config, flagStyle);
    //BeamRegistry.ensure(token, config, config.visualStyle ?? BeamVisualStyle.LASER);

    updateBeam(token);
    //startShaderAnimation();
}

function findHitTokens(segment, token) {
    let hitTokens = getTokensAlongSegment(segment.start, segment.end, token);
    console.log("findHitTokens")
    console.log(hitTokens)
    return hitTokens
}

/**
 * Wrapper that rebuilds the beam segment list from token data using the
 * legacy math in computeBeamSegmentsWithNormals.
 * @param {Token} token – placeable token (not TokenDocument)
 * @param {object} cfg  – beam flag/config (needs .offset)
 * @param {object|null} override – partial {x,y,rotation,width,height} from cached updates
 * @returns {Array} list of raw segment objects
 */
function calculateBeamSegments(token, cfg = {}, override = null) {
    // --- Gather up‑to‑date position ------------------------------------------------
    const doc = token.document;
    const x = override?.x ?? doc.x;
    const y = override?.y ?? doc.y;
    const rotDeg = override?.rotation ?? doc.rotation;
    const w = override?.width ?? token.w;
    const h = override?.height ?? token.h;

    // Origin is token centre
    const origin = { x: x + w / 2, y: y + h / 2 };
    const rotationRad = rotDeg * Math.PI / 180;
    const maxDist = 99_999; // unchanged, effectively ‘infinite’
    // Resolve maxBounces: token flag (if ever added) → cfg → world setting
    const flagMax = doc.getFlag(MOD_NAME, "beam")?.maxBounces;
    const cfgMax = cfg.maxBounces;
    const worldMax = game.settings.get(MOD_NAME, "maxBounces");
    const maxBounces = Number.isFinite(flagMax) ? flagMax
        : Number.isFinite(cfgMax) ? cfgMax
            : worldMax;

    return computeBeamSegmentsWithNormals(
        origin,
        rotationRad,
        maxDist,
        cfg.offset ?? 0,
        maxBounces
    );
}


export function updateBeam(token, override = null, forceUpdate = false) {
    console.log(`[${MOD_NAME} - updateBeam ???????????????????????????????@@@@@@@@@@@@@`)
    console.log(token)
    const existing = beams.get(token.id);
    const changedStyle = override?.flags?.["foundry-beams"]?.beam?.style !== undefined;
    const changedColor = override?.flags?.["foundry-beams"]?.beam?.colorHex !== undefined;
    const changedWidth = override?.flags?.["foundry-beams"]?.beam?.width !== undefined;
    const changedOffset = override?.flags?.["foundry-beams"]?.beam?.offset !== undefined;
    const changedActive = override?.flags?.["foundry-beams"]?.beam?.active !== undefined;

    console.log("changedStyle:", changedStyle)
    console.log("changedColor:", changedColor)
    console.log("changedActive:", changedActive)
    console.log(`[${MOD_NAME}] - "existing" variable:`, existing)
    const inst = BeamRegistry.get(token.id);
    console.log(`[${MOD_NAME}] - "inst" variable:`, inst)
    const prevWalls = inst?.hitWalls ?? new Set();
    if (!existing) return; // safety
    const flagCfg = token.document.getFlag("foundry-beams", "beam") ?? {};
    console.log("Flag config:", flagCfg)
    const cfg = { ...existing.config, ...flagCfg };   // ← latest values
    console.log("Config:", cfg)
    existing.config = cfg;                                  // keep legacy map in sync
    const doc = token.document;
    const flagStyle = override?.flags?.["foundry-beams"]?.beam?.style ?? doc.getFlag(MOD_NAME, "beam")?.style;
    const isActive = override?.flags?.["foundry-beams"]?.beam?.active ?? doc.getFlag(MOD_NAME, "beam")?.active;
    console.log("isactive:", isActive)
    const flagColor = flagCfg.colorHex;
    const beamInst = BeamRegistry.ensure(token, cfg, flagStyle);
    console.log("Beam instance:", beamInst)
    console.log("Style in beamInst:", beamInst.style)
    const style = StyleRegistry.get(beamInst.style) ?? StyleRegistry.get("laser");
    console.log("Style:", style)
    if (changedStyle || changedColor || changedWidth || changedOffset || forceUpdate || (changedActive)) {
        // FULL reset ─ destroy all old containers, clear segments & legacy array
        for (const seg of beamInst.segments.values()) {
            seg.container?.parent?.removeChild(seg.container);
            seg.container?.destroy({ children: true });
        }
        beamInst.segments.clear();          // start afresh
        existing.containers.length = 0;
        beamInst.style = flagStyle;
        beamInst.colorHex = flagColor;
        // we must delete the stuff with the old style
        style.deleteAllSegments(token, beamInst);
        //stopEffect(token); // stop any existing effects
    }
    style.deleteAllSegments(token, beamInst);

    // if the beam is not active we do not draw anything
    if (!isActive) {
        console.log("the beam is not active")
        if (changedActive) {
            disableRegion(token)
            // we also fire the wall leave event for all the walls currently hit
            console.log("hit walls:", inst?.hitWalls)
            if (inst?.hitWalls) {
                for (const wallId of inst.hitWalls) {
                    const wall = canvas.scene?.walls?.get(wallId);
                    Hooks.callAll("foundry-beams.wall-leave", { wall, wallId, token, beam: inst, reason: "deactivate" });
                }
            }
        }
        return
    }
    if (changedActive && isActive) {
        enableRegion(token)
        // we also need to fire the wall enter event for all the walls currently hit
        if (inst?.hitWalls) {
            for (const wallId of inst.hitWalls) {
                const wall = canvas.scene?.walls?.get(wallId);
                Hooks.callAll("foundry-beams.wall-enter", { wall, wallId, token, beam: inst });
            }
        }
    }

    const curX = override?.x ?? doc.x;
    const curY = override?.y ?? doc.y;
    const curRot = override?.rotation ?? doc.rotation;
    const w = override?.width ?? token.w;
    const h = override?.height ?? token.h;
    console.log(`x: ${curX}| y: ${curY} | w: ${w}| h: ${h}| rot: ${curRot}`)
    const curColor = override?.flags?.["foundry-beams"]?.beam?.colorHex ?? doc.getFlag(MOD_NAME, "beam")?.colorHex;
    const curStyle = override?.flags?.["foundry-beams"]?.beam?.style ?? doc.getFlag(MOD_NAME, "beam")?.style;
    const curWidth = override?.flags?.["foundry-beams"]?.beam?.width ?? doc.getFlag(MOD_NAME, "beam")?.width;
    const curOffset = override?.flags?.["foundry-beams"]?.beam?.offset ?? doc.getFlag(MOD_NAME, "beam")?.offset;

    if (beamInst._lastX === curX && beamInst._lastY === curY && beamInst._lastRot === curRot && !(changedStyle || changedColor || changedWidth || changedOffset || forceUpdate || changedActive)) {
        // No position/rotation change → only lightning jitter needs running
        console.log(`[foundry-beams] No position change for ${token.name} at ${curX},${curY} rot: ${curRot} color: ${curColor} style: ${curStyle}`);
        return;
    }
    console.log(`[foundry-beams] updateBeam for ${token.name} at ${curX},${curY} rot: ${curRot} color: ${curColor} style: ${curStyle}`);
    beamInst._lastX = curX;
    beamInst._lastY = curY;
    beamInst._lastRot = curRot;
    beamInst.colorHex = curColor;
    beamInst.width = curWidth;
    beamInst.offset = curOffset;

    // 1. build fresh geometry list (as before)
    const segments = calculateBeamSegments(token, existing.config, override);
    console.log("BEAMS - Segments:", segments)

    const next = new Set(segments.map(s => s.wallId).filter(Boolean));
    // enter: in next but not in prev
    for (const wallId of next) {
        if (!prevWalls.has(wallId)) {
            const wall = canvas.scene?.walls?.get(wallId);
            const mirrorData = foundry.utils.getProperty(wall, "flags.foundry-beams.mirror") ?? {};
            if (mirrorData?.isReactive && mirrorData?.macro) {
                Hooks.callAll("foundry-beams.wall-enter", { wall: wall, token: token, beam: inst, mirrorData: mirrorData });
            }
        }
    }
    // leave: in prevWalls but not in next
    for (const wallId of prevWalls) {
        if (!next.has(wallId)) {
            const wall = canvas.scene?.walls?.get(wallId);
            const mirrorData = foundry.utils.getProperty(wall, "flags.foundry-beams.mirror") ?? {};
            if (mirrorData?.isReactiveExit && mirrorData?.macroExit) {
                Hooks.callAll("foundry-beams.wall-exit", { wall: wall, token: token, beam: inst, mirrorData: mirrorData });
            }
        }
    }

    // now we need to update the hitWalls set in the beam instance
    BeamRegistry.setWalls(token.id, next);

    // 3. update / create each segment
    //        beamInst.segments = segments
    console.log(`[${MOD_NAME}]BEFORE - updateBeam processSegments @@@@@@@@@@@`, segments, beamInst)
    existing.containers = style.processSegments(segments, cfg, beamInst, token);
    // 4. Clean up extra segments (if beam shortened this frame) ---------------
    const desired = segments.length;
    for (const [id, seg] of [...beamInst.segments]) {
        if (Number(id) >= desired) {
            const style = StyleRegistry.get(beamInst.style);
            style?.destroy?.(seg);
            seg.container?.destroy({ children: true });
            beamInst.segments.delete(id);
            existing.containers.splice(Number(id), 1);
        }
    }

    // 5. (Re)build Region polygon if flag is set -----------------------------
    // TODO check if this has meaning I should already have config info of beamInst
    const beamFlags = token.document.getFlag("foundry-beams", "beam") ?? {};
    if (beamFlags.hasRegion && game.users.activeGM?.isSelf) {
        // This helper lives in beams-region.js and still expects the raw
        // segment list from computeBeamSegmentsWithNormals (has dx,dy,normal)
        createRegionFromSegments(segments, token);
    }
}

// normal vector per segment
function computeBeamSegmentsWithNormals(origin, initialDirectionRad, maxDistance, beamOffset, maxBouncesParam = 3) {
    const segments = [];
    let currentPoint = origin;
    let direction = initialDirectionRad;
    let bounces = 0;
    let lastCollisionEdgeId = null;
    const maxBounces = maxBouncesParam;

    while (bounces < maxBounces) {
        const dest = Ray.fromAngle(currentPoint.x, currentPoint.y, direction, maxDistance).B;
        // Check for collisions with walls or outer bounds
        const collisions = CONFIG.Canvas.polygonBackends.move.testCollision(currentPoint, dest, {
            mode: "all",
            type: "light"
        });
        // TODO: at the moment the collided token is not used, but we keep it for future enhancements
        // if we want to check for collisions with tokens
        // Test for collisions with tokens
        const collidedTk = CONFIG.Canvas.polygonBackends.move.testCollision(currentPoint, dest, { type: "sight", mode: "all" });

        console.log("collidedTk")
        console.log(collidedTk)

        if (isDebugActive) console.log(collisions);
        if (collisions.length == 0) {
            // No collisions
            break;
        }
        // here we need to get the first element of the array
        let collisionElement = collisions.shift();
        // if it is the same edge as the previous it means that there is an imprecision in the testCollision and I'm bouncing on the same wall
        if (collisionElement.edges.values().next().value.id == lastCollisionEdgeId) {
            collisionElement = collisions.shift();
        }
        // now we are sure we are on the next wall; that should be either a wall or the outerbound or null
        if (collisionElement.edges.values().next().value.type == "outerBounds") {
            // if it is outerbound I need to keep the wall but stop bouncing but BEFORE if first bounce> OFFSET
            if (bounces === 0) {
                // it is the first segment we want to offset it as set in the config
                currentPoint = {
                    x: origin.x + Math.cos(direction) * beamOffset,
                    y: origin.y + Math.sin(direction) * beamOffset
                };
                //                console.log(`BEAM DIRECTION RAD: ${direction}`);
                //                console.log(`OFFSET POINT: x=${currentPoint.x}, y=${currentPoint.y}`);
            }
            // since we hit the outer bounds we need to set the bounces to maxBounces
            if (isDebugActive) console.log(`[foundry-beams] Beam hit outer bounds. Stopping bounces.`);
            bounces = maxBounces;
        }
        let endPoint = collisionElement ?? dest;
        const edgeData = collisionElement.edges.values().next().value;
        if (isDebugActive) console.log(edgeData);

        const dx = endPoint.x - currentPoint.x;
        const dy = endPoint.y - currentPoint.y;
        console.log(`dx: ${dx} | dy: ${dy} `)
        let length = Math.hypot(dx, dy);
        if (isDebugActive) console.log(length);
        const normal = [-dy / length, dx / length];

        // offset of the starting segment
        if (bounces === 0) {
            // it is the first segment
            currentPoint = {
                x: origin.x + Math.cos(direction) * beamOffset,
                y: origin.y + Math.sin(direction) * beamOffset
            };
            length -= beamOffset
            console.log(`BEAM DIRECTION RAD: ${direction}`);
            console.log(`OFFSET POINT: x=${currentPoint.x}, y=${currentPoint.y}`);
        }

        const wallId = edgeData?.object?.document?.id ?? null;
        console.log(`[${MOD_NAME} - WALL ID: ${wallId}`);
        segments.push({ start: currentPoint, end: { x: endPoint.x, y: endPoint.y }, dx, dy, length, normal, wallId });
        if (isDebugActive) console.log("after wall check");
        // added to solve the imprecision in the collision
        if (collisionElement == null) break;

        const mirror = edgeData?.object?.document.getFlag(MOD_NAME, "mirror")
        console.log(mirror)
        // looking id the wall is a reactive
        // this part is not needed anymore due to the wall hooks
        //const isReactive = mirror?.isReactive ?? false;
        // TODO: need to check if is really needed to check if the user is GM
        //if (isReactive && game.users.activeGM.isSelf) {
            // if is reactive we need to execute the macro associated
          //  reactiveMacro(mirror?.macro);
            // TODO here there could be the generation of an event for the wall hit
            // TODO we need to have a structure for saving the wall hit so we can also be able to understand if a beam leaves a reactive wall

        //}

        // looking if the wall is a mirror
        const isMirror = mirror?.isMirror ?? false;
        if (!isMirror) break;
        lastCollisionEdgeId = edgeData.id;


        const A = edgeData.a;
        const B = edgeData.b;

        const wallDX = B.x - A.x;
        const wallDY = B.y - A.y;

        // Normalize incident vector
        const incident = { x: dx / length, y: dy / length };
        console.log(incident)
        const wallLength = Math.hypot(wallDX, wallDY);
        console.log(wallLength)
        const wallVec = { x: wallDX / wallLength, y: wallDY / wallLength };
        console.log(wallVec)
        const normalW = { x: -wallVec.y, y: wallVec.x }; // perpendicular
        console.log(normalW)

        const dot = incident.x * normalW.x + incident.y * normalW.y;
        console.log(dot)
        const rx = incident.x - 2 * dot * normalW.x;
        const ry = incident.y - 2 * dot * normalW.y;

        direction = Math.atan2(ry, rx);
        if (isDebugActive) console.log(`[foundry-beams] Reflection #${bounces + 1} at mirror.  in: ${direction.toFixed(3)} `);

        // now direction = reflection;
        console.log(direction)
        currentPoint = endPoint;
        bounces++;
        if (isDebugActive) console.log(`[foundry-beams] Beam reflected at mirror wall. Bounce #${bounces}, new angle: ${direction}`);

    }

    return segments;
}
export function destroyBeam(token) {
    const beam = beams.get(token.id);
    if (!beam) return;
    const flagStyle = beam.config?.style ?? "laser";
    const inst = BeamRegistry.get(token.id);
    if (inst?.hitWalls) {
        for (const wallId of inst.hitWalls) {
            const wall = canvas.scene?.walls?.get(wallId);
            Hooks.callAll("foundry-beams.wall-leave", { wall, wallId, token, beam: inst, reason: "destroy" });
        }
    }
    const style = StyleRegistry.get(flagStyle) ?? StyleRegistry.get("laser");
    style.deleteAllSegments(token)
    deleteBeamRegions(token);
    for (const { container } of beam.containers) container.destroy({ children: true });
    beams.delete(token.id);
    // Phase 1 cleanup in new registry
    BeamRegistry.delete(token.id);
    if (isDebugActive) console.log(`[foundry-beams] Beam fully destroyed for ${token.name}`);
}

