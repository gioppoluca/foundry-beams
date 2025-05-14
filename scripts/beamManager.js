// beamManager.js — updated to support directional shader lighting with segment normal vector
import { buildBeamSegment } from './beam-shader.js';

export const beams = new Map(); // token.id -> { containers[], config }

// Fragment shader code with directional fading based on normal vector
const fragmentShaderCode = `
  precision mediump float;
  varying vec2 vTextureCoord;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform vec2 uNormal;

  void main() {
    vec2 centered = vTextureCoord - vec2(0.5);
    float dist = abs(dot(centered, uNormal));
    float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
    float alpha = smoothstep(0.5, 0.0, dist) * pulse * uIntensity;
    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`;


let shaderTickerRegistered = false;
function startShaderAnimation() {
    if (shaderTickerRegistered) return;
    console.log("[foundry-beams] Starting shader ticker");
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
    const flag = token.getFlag("foundry-beams", "beam") || {};
    const isEnabled = forceEnable !== null ? forceEnable : !flag.enabled;
    console.log(`[foundry-beams] toggleBeam for ${token.name}: ${isEnabled}`);

    if (isEnabled) {
        createBeam(token, flag);
    } else {
        destroyBeam(token);
    }

    await token.setFlag("foundry-beams", "beam", { ...flag, enabled: isEnabled });
}

export function createBeam(token, config = {}) {
    console.log(`[foundry-beams] Creating beam for ${token.name}`);
    beams.set(token.id, { containers: [], config });
    updateBeam(token);
    startShaderAnimation();
}


export function updateBeam(token, override = {}) {
  const existing = beams.get(token.id);
  if (!existing) {
    console.warn(`[foundry-beams] Cannot update beam for ${token.name} — no beam container set`);
    return;
  }

  for (const { container } of existing.containers) container.destroy({ children: true });
  existing.containers = [];

  const config = existing.config;
  const x = override.x ?? token.x;
  const y = override.y ?? token.y;
  const w = override.width ?? token.w;
  const h = override.height ?? token.h;
  const rotation = override.rotation ?? token.rotation;

  const origin = { x: x + w / 2, y: y + h / 2 };
  const segments = computeBeamSegmentsWithNormals(origin, rotation * Math.PI / 180, 99999);

  console.log(`[foundry-beams] updateBeam - Drawing ${segments.length} beam segment(s) for ${token.name}`);
  let useNormalShader = config.useNormalShader ?? false; // set this in config if desired
  useNormalShader = false;

  for (const segment of segments) {
    const { container, filter } = buildBeamSegment({ segment, config, useNormalShader });
    canvas.effects.addChild(container);
    existing.containers.push({ container, filter });

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
}

// ➕ New version of computeBeamSegments that includes normal vector per segment
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
        console.log(collisions);
        if (collisions.length == 0) break;
        // here we need to get the first element of the array
        let collisionElement = collisions.shift();
        //do{
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
        console.log(edgeData);

    const dx = endPoint.x - currentPoint.x;
    const dy = endPoint.y - currentPoint.y;
        console.log(`dx: ${dx} | dy: ${dy} `)
    const length = Math.hypot(dx, dy);
        console.log(length);
    const normal = [-dy / length, dx / length];

        segments.push({ start: currentPoint, end: endPoint, dx, dy, length, normal });
        console.log("after wall check");
        // added to solve the imprecision in the collision
        if (collisionElement == null) break;


        // looking id the wall is a mirror
        const isMirror = edgeData?.object?.document.getFlag("foundry-beams", "mirror.isMirror") ?? false;
    if (!isMirror) break;
/*
    const edgeId = Array.from(collision.edgeIds)[0];
    if (edgeId === lastCollisionEdgeId) {
      console.warn("[foundry-beams] Repeated collision with same wall segment. Avoiding infinite bounce.");
      break;
    }
      */
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
        console.log(`[foundry-beams] Reflection #${bounces + 1} at mirror.  in: ${direction.toFixed(3)} `);

        //direction = reflection;
        console.log(direction)
        currentPoint = endPoint;
            bounces++;
                    console.log(`[foundry-beams] Beam reflected at mirror wall. Bounce #${bounces}, new angle: ${direction}`);

  }

  return segments;
}
export function destroyBeam(token) {
    const beam = beams.get(token.id);
    if (!beam) return;
    for (const { container } of beam.containers) container.destroy({ children: true });
    beams.delete(token.id);
    console.log(`[foundry-beams] Beam fully destroyed for ${token.name}`);
}

function hexToRGB(hex) {
    const bigint = parseInt(hex.replace("#", ""), 16);
    return [
        ((bigint >> 16) & 255) / 255,
        ((bigint >> 8) & 255) / 255,
        (bigint & 255) / 255
    ];
}