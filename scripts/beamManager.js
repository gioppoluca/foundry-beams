import { isDebugActive } from "./module.js";
import { MOD_NAME } from "./beams-const.js";
import { buildBeamSegment } from './beam-shader.js';
import { reactiveMacro } from './beams-macro.js';
import { createRegionFromSegments, deleteBeamRegions } from './beams-region.js';
import { getTokensAlongSegment, createLightning } from "./beams-util.js";
import { BeamRegistry, BeamVisualStyle, ensureSegment } from "./beamData.js";

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
    // the toggleBean receives a TokenDocument
    // const flag = token.document.getFlag(MOD_NAME, "beam") || {};
    const flag = token.getFlag(MOD_NAME, "beam") || {};
    // if it is already enabled there is no sens in doing it again
    //    if (flag.enabled === forceEnable)
    //        return;
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
    BeamRegistry.ensure(token, config, config.visualStyle ?? BeamVisualStyle.LASER);

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

    return computeBeamSegmentsWithNormals(
        origin,
        rotationRad,
        maxDist,
        cfg.offset ?? 0,
    );
}


export function updateBeam(token, override = null) {
    const existing = beams.get(token.id);
    if (!existing) return; // safety


    const beamInst = BeamRegistry.ensure(token, existing.config);

    const doc = token.document;
    const curX = override?.x ?? doc.x;
    const curY = override?.y ?? doc.y;
    const curRot = override?.rotation ?? doc.rotation;
    if (beamInst._lastX === curX && beamInst._lastY === curY && beamInst._lastRot === curRot) {
        // No position/rotation change → only lightning jitter needs running
        return;
    }
    beamInst._lastX = curX;
    beamInst._lastY = curY;
    beamInst._lastRot = curRot;
    //    beamInst._lastX = doc.x;
    //    beamInst._lastY = doc.y;
    //    beamInst._lastRot = doc.rotation;

    // 1. build fresh geometry list (as before)
    //const segments = calculateBeamSegments(token, existing.config); // ← original helper
    const segments = calculateBeamSegments(token, existing.config, override);


    // 2. get (or create) registry entry – do NOT clear anymore
    //    const beamInst = BeamRegistry.ensure(token, existing.config);

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

        // --- Ensure PIXI container exists --------------------------------------
        if (!seg.container) {
            // create once depending on beam style
            beamInst.style = BeamVisualStyle.LIGHTNING; // default to lightning for now
            console.log("Style:", beamInst.style)

            seg.container = (beamInst.style === BeamVisualStyle.LIGHTNING)
                ? createLightningContainer(seg, existing.config)   // GSAP path – Phase 3 polishing
                : createLaserContainer(seg, existing.config);      // default path
            canvas.effects.addChild(seg.container);
            // Remember for legacy API consumers
            existing.containers[i] = { container: seg.container, filter: seg.container.filter };
        }

        // --- Update visuals (rotation / length) --------------------------------
        updateSegmentDisplay(seg, existing.config, beamInst.style);
    }

    // 4. Clean up extra segments (if beam shortened this frame) ---------------
    const desired = segments.length;
    for (const [id, seg] of [...beamInst.segments]) {
        if (Number(id) >= desired) {
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

/*
export function updateBeam(token, override = null) {
    const existing = beams.get(token.id);
    const beamInst = BeamRegistry.ensure(token, existing.config);
    beamInst.clear();               // Phase 1 mirrors current destroy‑rebuild strategy
    console.log("UPDATEBEAM")
    console.log(token)
    const beamConfig = token.document.getFlag(MOD_NAME, "beam");
    // console.log(existing)
    if (!existing) {
        console.warn(`[foundry-beams] Cannot update beam for ${token.name} — no beam container set`);
        return;
    }

    for (const { container } of existing.containers) container.destroy({ children: true });
    existing.containers = [];
    let containersForRegions = [];
    let config = existing.config;
    config.colorHex = beamConfig.colorHex;
    // rotation, X and Y must always be red on the document since in the placeable it is not ready
    const x = override?.x ?? token.document.x;
    const y = override?.y ?? token.document.y;
    const rotation = override?.rotation ?? token.document.rotation;
    // W and H are present in the placeable
    const w = override?.width ?? token.w;
    const h = override?.height ?? token.h;

    console.log(override)
    console.log(override?.x)
    console.log(token?.x)
    console.log(`x: ${x}| y: ${y} | w: ${w}| h: ${h}| ret: ${rotation}`)
    console.log(token)

    const origin = { x: x + w / 2, y: y + h / 2 };
    // console.log(origin)
    const segments = computeBeamSegmentsWithNormals(origin, rotation * Math.PI / 180, 99999, beamConfig.offset ?? 0);

    if (isDebugActive) console.log(`[foundry-beams] updateBeam - Drawing ${segments.length} beam segment(s) for ${token.name}`);
    let useNormalShader = config.useNormalShader ?? false; // set this in config if desired
    useNormalShader = false;
    // console.log("|||segments")
    // console.log(segments)

    let hitTokens = []

    for (const segment of segments) {
        const { container, filter } = buildBeamSegment({ segment, config, useNormalShader });
        // console.log("|||CONTAINER")
        // console.log(container)
        // console.log(container.children[0].vertexData)

        //container.zIndex = -1;
        //        canvas.effects.addChild(container);
        canvas.lighting.addChild(container);
        //canvas.stage.addChild(container);
        //        canvas.tokens.addChild(container);
        //        canvas.beams.addBeam(container)
        //        canvas.effects.sortChildren();
        //canvas.tokens.sortableChildren = true;
        //canvas.stage.sortableChildren = true;
        //canvas.effects.sortableChildren = true;
        canvas.lighting.sortableChildren = true;

        existing.containers.push({ container, filter });
        const endX = segment.start.x + segment.dx;
        const endY = segment.start.y + segment.dy;
        // Phase 1: push into the authoritative Map (id = bounce index)
       const segId = String(beamInst.segments.size);
       beamInst.segments.set(segId, {
         id: segId,
         start: segment.start,
         end: { x: endX, y: endY },
         normal: segment.normal,
         length: segment.length,
         container,
         filter,
       });
        containersForRegions.push(container);

        // Add marker at the segment's end (excluding last one)
        //    if (i < segments.length - 1) {
        createLightning({ start: { x: segment.start.x, y: segment.start.y }, end: { x: endX, y: endY }, color: 0xffccff, flicker: 30, loop: true, thickness: 4 });

        if (isDebugActive) {
            const endX = segment.start.x + segment.dx;
            const endY = segment.start.y + segment.dy;

            const marker = new PIXI.Graphics();
            marker.beginFill(0xff0000);
            marker.drawCircle(0, 0, 6);
            marker.endFill();
            marker.x = endX;
            marker.y = endY;
            canvas.effects.addChild(marker);
            existing.containers.push({ container: marker });
            hitTokens = hitTokens.concat(findHitTokens(segment, token))
        }
        //  }
    }
    //    console.log(beams)
    //    console.log("hittokens||||||||")
    //    console.log(hitTokens)
    if (beamConfig.hasRegion && game.users.activeGM?.isSelf) {
        createRegionFromSegments(segments, token);
    }
}
*/
// normal vector per segment
function computeBeamSegmentsWithNormals(origin, initialDirectionRad, maxDistance, beamOffset) {
    const segments = [];
    let currentPoint = origin;
    let direction = initialDirectionRad;
    let bounces = 0;
    let lastCollisionEdgeId = null;
    const maxBounces = 3;

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



function createLaserContainer(seg, cfg) {
    // Build a single sprite + blur‑glow container that we can
    // *rotate & scale* every frame from updateSegmentDisplay.

    // --- Geometry helpers
    const dx = seg.end.x - seg.start.x;
    const dy = seg.end.y - seg.start.y;
    const len = seg.length || Math.hypot(dx, dy); (dx, dy);

    // --- Parent container (lets us rotate without skewing the blur)
    const cont = new PIXI.Container();
    cont.zIndex = 9_000;           // render above most things
    cont.sortableChildren = true;
    cont.blendMode = PIXI.BLEND_MODES.ADD;

    // --- Beam body sprite ---------------------------------------------------
    const beam = new PIXI.Sprite(PIXI.Texture.WHITE);
    beam.anchor.set(0, 0.5);       // left‑edge origin so width = length
    beam.width = len;             // initial, will be kept in sync each tick
    beam.height = cfg.width ?? 30;
    beam.tint = PIXI.utils.string2hex(cfg.colorHex ?? "#ffe699");
    beam.blendMode = PIXI.BLEND_MODES.ADD;

    // Soft glow
    let blur = laserBlurCache.get(cfg.cacheKey);
    if (!blur) {
        blur = new PIXI.filters.BlurFilter();
        blur.blur = 4;
        laserBlurCache.set(cfg.cacheKey, blur);
    }
    //    const blur = new PIXI.filters.BlurFilter();
    //    blur.blur = 4;                 // softness radius – tuneable via cfg later
    beam.filters = [blur];


    cont.addChild(beam);

    // --- Initial transform --------------------------------------------------
    cont.position.set(seg.start.x, seg.start.y);
    cont.rotation = Math.atan2(dy, dx);

    // Expose first filter for the shader‑ticker even though laser has no
    // animated uniforms — keeps the legacy data‑shape intact.
    cont.filter = blur;

    return cont;
}

function createLightningContainer(seg, cfg) {
    const cont = new PIXI.Container();
    cont.zIndex = 9_001;
    cont.blendMode = PIXI.BLEND_MODES.ADD;

    // Create a Graphics line we can mutate quickly
    const gfx = new PIXI.Graphics();
    cont.addChild(gfx);

    // Build initial points array (simple zig‑zag) – will be jittered each tick
    const points = buildLightningPoints(seg.length, cfg.segments ?? 20);
    seg.points = points;   // ← keep a reference for refresh
    drawLightning(gfx, points, cfg.colorHex ?? "#a7d5f9", cfg.width ?? 5);

    // Attach a jitter function called each ticker frame
    seg.jitterFn = (delta) => {
        jitterPoints(points, 4);               // small random offset
        drawLightning(gfx, points, cfg.colorHex ?? "#a7d5f9", cfg.width ?? 5);
    };

    cont.position.set(seg.start.x, seg.start.y);
    cont.rotation = Math.atan2(seg.end.y - seg.start.y, seg.end.x - seg.start.x);

    return cont;
}

function buildLightningPoints(len, count) {
    const pts = [0];
    for (let i = 1; i < count; i++) pts.push((i / count) * len);
    return pts;
}

function jitterPoints(pts, range) {
    for (let i = 1; i < pts.length - 1; i++) {
        pts[i] += (Math.random() - 0.5) * range;
    }
}

function drawLightning(gfx, pts, color, width) {
    gfx.clear();
    gfx.lineStyle(width, PIXI.utils.string2hex(color));
    gfx.moveTo(0, 0);
    for (const x of pts) gfx.lineTo(x, (Math.random() - 0.5) * 20);
}

function updateSegmentDisplay(seg, cfg, style) {
    const { container } = seg;
    // rotate / scale sprite(s) inside container to match new start→end
    const dx = seg.end.x - seg.start.x;
    const dy = seg.end.y - seg.start.y;
    const angle = Math.atan2(dy, dx);
    const len = Math.hypot(dx, dy);
    container.position.set(seg.start.x, seg.start.y);
    container.rotation = angle;
    // assume first child is the beam graphic (rectangle, mesh, etc.)
    const beamSprite = container.children[0];

    if (style === BeamVisualStyle.LIGHTNING) {
        // If the bolt length changed, rebuild its point array & redraw once
        if (seg.prevLen !== len) {
            seg.prevLen = len;
            seg.points = buildLightningPoints(len, cfg.segments ?? 20);
            // replace jitterFn so the ticker uses the fresh array
            seg.jitterFn = (delta) => {
                jitterPoints(seg.points, 4);
                drawLightning(beamSprite, seg.points, cfg.colorHex ?? "#a7d5f9", cfg.width ?? 5);
            };
            drawLightning(beamSprite, seg.points, cfg.colorHex ?? "#a7d5f9", cfg.width ?? 5);
        }
    } else {
        // LASER: the child is a Sprite so width scaling is fine
        beamSprite.width = len;
    }
    // debug markers (keep) ----------------------------------------------
    if (cfg.debug) {
        if (!seg.debugStart) {
            seg.debugStart = new PIXI.Graphics().beginFill(0x00ff00).drawCircle(0, 0, 3);
            seg.debugEnd = new PIXI.Graphics().beginFill(0xff0000).drawCircle(0, 0, 3);
            container.addChild(seg.debugStart, seg.debugEnd);
        }
        seg.debugStart.position.set(0, 0);
        seg.debugEnd.position.set(len, 0);
    } else if (seg.debugStart) {
        container.removeChild(seg.debugStart);
        container.removeChild(seg.debugEnd);
        seg.debugStart = seg.debugEnd = undefined;
    }
    if (style === BeamVisualStyle.LIGHTNING && !seg.jitterFn) {
        // Segment was recreated without a jitter function – rebuild quickly
        const gfx = container.children[0];
        seg.points = seg.points || buildLightningPoints(len, cfg.segments ?? 20);
        seg.jitterFn = (delta) => {
            jitterPoints(seg.points, 4);
            drawLightning(gfx, seg.points, cfg.colorHex ?? "#a7d5f9", cfg.width ?? 5);
        };
    }
}