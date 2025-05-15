import { isDebugActive } from "./module.js";
import { MOD_NAME } from "./beams-const.js";
// beamManager.js — updated to support directional shader lighting with segment normal vector
import { buildBeamSegment } from './beam-shader.js';
import { reactiveMacro } from './beams-macro.js';
import { createRegionFromSegments } from './beams-region.js';

export const beams = new Map(); // token.id -> { containers[], config }


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
    const flag = token.document.getFlag(MOD_NAME, "beam") || {};
    const isEnabled = forceEnable !== null ? forceEnable : !flag.enabled;
    if (isDebugActive) console.log(`[foundry-beams] toggleBeam for ${token.name}: ${isEnabled}`);

    if (isEnabled) {
        createBeam(token, flag);
    } else {
        destroyBeam(token);
    }

    await token.document.setFlag(MOD_NAME, "beam", { ...flag, enabled: isEnabled });
}

export function createBeam(token, config = {}) {
    if (isDebugActive) console.log(`[foundry-beams] Creating beam for ${token.name}`);
    beams.set(token.id, { containers: [], config });
    updateBeam(token);
    startShaderAnimation();
}


export function updateBeam(token, override = null) {
    const existing = beams.get(token.id);
    console.log("UPDATEBEAM")
    console.log(existing)
    if (!existing) {
        console.warn(`[foundry-beams] Cannot update beam for ${token.name} — no beam container set`);
        return;
    }

    for (const { container } of existing.containers) container.destroy({ children: true });
    existing.containers = [];
let containersForRegions = [];
    const config = existing.config;
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
    console.log(origin)
    const segments = computeBeamSegmentsWithNormals(origin, rotation * Math.PI / 180, 99999);

    if (isDebugActive) console.log(`[foundry-beams] updateBeam - Drawing ${segments.length} beam segment(s) for ${token.name}`);
    let useNormalShader = config.useNormalShader ?? false; // set this in config if desired
    useNormalShader = false;
        console.log("|||segments")
        console.log(segments)

    for (const segment of segments) {
        const { container, filter } = buildBeamSegment({ segment, config, useNormalShader });
        console.log("|||CONTAINER")
        console.log(container)
        console.log(container.children[0].vertexData)
        
        canvas.effects.addChild(container);
        existing.containers.push({ container, filter });
        containersForRegions.push(container);

        // Add marker at the segment's end (excluding last one)
        //    if (i < segments.length - 1) {
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
        //  }
    }
    console.log(beams)
    console.log(existing)
    createRegionFromSegments(segments, token);
}

// normal vector per segment
function computeBeamSegmentsWithNormals(origin, initialDirectionRad, maxDistance) {
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
        if (isDebugActive) console.log(collisions);
        if (collisions.length == 0) break;
        // here we need to get the first element of the array
        let collisionElement = collisions.shift();
        // if it is the same edge as the previous it means that there is an imprecision in the testCollision and I'm bouncing on the same wall
        if (collisionElement.edges.values().next().value.id == lastCollisionEdgeId) {
            collisionElement = collisions.shift();
        }
        // now we are sure we are on the next wall; that should be either a wall or the outerbound or null
        if (collisionElement.edges.values().next().value.type == "outerBounds") {
            // if it is outerbound I need to keep the wall but stop bouncing
            bounces = maxBounces;
        }
        let endPoint = collisionElement ?? dest;
        const edgeData = collisionElement.edges.values().next().value;
        if (isDebugActive) console.log(edgeData);

        const dx = endPoint.x - currentPoint.x;
        const dy = endPoint.y - currentPoint.y;
        console.log(`dx: ${dx} | dy: ${dy} `)
        const length = Math.hypot(dx, dy);
        if (isDebugActive) console.log(length);
        const normal = [-dy / length, dx / length];

        segments.push({ start: currentPoint, end: endPoint, dx, dy, length, normal });
        if (isDebugActive) console.log("after wall check");
        // added to solve the imprecision in the collision
        if (collisionElement == null) break;

        const mirror = edgeData?.object?.document.getFlag(MOD_NAME, "mirror")
        console.log(mirror)
        // looking id the wall is a reactive
        const isReactive = mirror?.isReactive ?? false;
        if (isReactive) {
            // if is reactive we need to execute the macro associated
            reactiveMacro(mirror?.macro);
        }

        // looking id the wall is a mirror
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
    for (const { container } of beam.containers) container.destroy({ children: true });
    beams.delete(token.id);
    if (isDebugActive) console.log(`[foundry-beams] Beam fully destroyed for ${token.name}`);
}

