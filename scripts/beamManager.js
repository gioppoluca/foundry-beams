import { MOD_NAME, isDebugActive } from "./beams-const.js";
import { reactiveMacro } from './beams-macro.js';
import { createRegionFromSegments, deleteBeamRegions } from './beams-region.js';
import { getTokensAlongSegment } from "./beams-util.js";
import { BeamRegistry, BeamVisualStyle, ensureSegment } from "./beamData.js";
import { StyleRegistry } from "./StyleRegistry.js";

export const beams = new Map(); // token.id -> { containers[], config }

const laserBlurCache = new Map(); // tokenId -> BlurFilter

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


export async function toggleBeam(token, forceEnable = null) {
    console.log(token)
    const flag = token.getFlag(MOD_NAME, "beam") || {};
    const isEnabled = forceEnable !== null ? forceEnable : !flag.enabled;
    if (isDebugActive) console.log(`[foundry-beams] toggleBeam for ${token.name}: ${isEnabled}`);

    if (isEnabled) {
        // we need to pass the token and not the TokenDocument
        createBeam(token.object, flag);
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
    startShaderAnimation();
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


export function updateBeam(token, override = null) {
    console.log("updateBeam")
    console.log(token)
    const existing = beams.get(token.id);
    const changedStyle = override?.flags?.["foundry-beams"]?.beam?.style !== undefined;
    const changedColor = override?.flags?.["foundry-beams"]?.beam?.colorHex !== undefined;
    const changedWidth = override?.flags?.["foundry-beams"]?.beam?.width !== undefined;
    const changedOffset = override?.flags?.["foundry-beams"]?.beam?.offset !== undefined;
    console.log("changedStyle:", changedStyle)
    console.log("changedColor:", changedColor)
    console.log(existing)
    if (!existing) return; // safety
    const flagCfg = token.document.getFlag("foundry-beams", "beam") ?? {};
    console.log("Flag config:", flagCfg)
    const cfg = { ...existing.config, ...flagCfg };   // ← latest values
    console.log("Config:", cfg)
    existing.config = cfg;                                  // keep legacy map in sync
    const doc = token.document;
    const flagStyle = override?.flags?.["foundry-beams"]?.beam?.style ?? doc.getFlag(MOD_NAME, "beam")?.style;
    const flagColor = flagCfg.colorHex;
    const beamInst = BeamRegistry.ensure(token, cfg, flagStyle);
    console.log("Beam instance:", beamInst)
    if (changedStyle || changedColor || changedWidth || changedOffset) {
        // FULL reset ─ destroy all old containers, clear segments & legacy array
        for (const seg of beamInst.segments.values()) {
            seg.container?.parent?.removeChild(seg.container);
            seg.container?.destroy({ children: true });
        }
        beamInst.segments.clear();          // start afresh
        existing.containers.length = 0;
        beamInst.style = flagStyle;
        beamInst.colorHex = flagColor;
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

    if (beamInst._lastX === curX && beamInst._lastY === curY && beamInst._lastRot === curRot && !(changedStyle || changedColor || changedWidth || changedOffset)) {
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

    // 3. update / create each segment
    for (let i = 0; i < segments.length; i++) {
        const segData = segments[i];
        const segId = String(i);

        // Re‑use or create BeamSegment shell
        const seg = ensureSegment(beamInst, segId);

        // --- Update geometry data (point calc unchanged) -----------------------
        seg.start = segData.start;
        seg.end = segData.end ?? {
            x: segData.start.x + (segData.dx ?? 0),
            y: segData.start.y + (segData.dy ?? 0)
        };
        seg.normal = segData.normal;
        seg.length = segData.length;
        const len = seg.length;  // <- add this

        // --- Update visuals (rotation / length) --------------------------------
        console.log("Style in beamInst:", beamInst.style)
        const style = StyleRegistry.get(beamInst.style) ?? StyleRegistry.get("laser");
        console.log("Style:", style)
        if (!seg.container) {
            seg.container = style.create(seg, cfg);
            canvas.effects.addChild(seg.container);

            // keep shader‑ticker compatible
            existing.containers.push({ container: seg.container, filter: seg.container.filter });
        } else {
            style.update(seg, cfg, len);
        }
    }

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
        const collisions = CONFIG.Canvas.polygonBackends.move.testCollision(currentPoint, dest, {
            mode: "all",
            type: "light"
        });
        const collidedTk = CONFIG.Canvas.polygonBackends.move.testCollision(currentPoint, dest, { type: "sight", mode: "all" });

        console.log("collidedTk")
        console.log(collidedTk)

        if (isDebugActive) console.log(collisions);
        if (collisions.length == 0) {
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
                // it is the first segment
                currentPoint = {
                    x: origin.x + Math.cos(direction) * beamOffset,
                    y: origin.y + Math.sin(direction) * beamOffset
                };
                console.log(`BEAM DIRECTION RAD: ${direction}`);
                console.log(`OFFSET POINT: x=${currentPoint.x}, y=${currentPoint.y}`);
            }
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

        // offset of the starting segment)
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

        segments.push({ start: currentPoint, end: endPoint, dx, dy, length, normal });
        if (isDebugActive) console.log("after wall check");
        // added to solve the imprecision in the collision
        if (collisionElement == null) break;

        const mirror = edgeData?.object?.document.getFlag(MOD_NAME, "mirror")
        console.log(mirror)
        // looking id the wall is a reactive
        const isReactive = mirror?.isReactive ?? false;
        if (isReactive && game.users.activeGM.isSelf) {
            // if is reactive we need to execute the macro associated
            reactiveMacro(mirror?.macro);
        }

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

        //direction = reflection;
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
    deleteBeamRegions(token);
    for (const { container } of beam.containers) container.destroy({ children: true });
    beams.delete(token.id);
    // Phase 1 cleanup in new registry
    BeamRegistry.delete(token.id);
    if (isDebugActive) console.log(`[foundry-beams] Beam fully destroyed for ${token.name}`);
}

