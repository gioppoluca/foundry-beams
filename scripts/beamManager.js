// beamManager.js with correct destroy/update order and debug output

export const beams = new Map(); // token.id -> { containers[], config }

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

    // Remove old segment containers before updating
    for (const { container } of existing.containers) container.destroy({ children: true });
    existing.containers = [];

    const config = existing.config;
    const x = override.x ?? token.x;
    const y = override.y ?? token.y;
    const w = override.width ?? token.w;
    const h = override.height ?? token.h;
    const rotation = override.rotation ?? token.rotation;

    const origin = { x: x + w / 2, y: y + h / 2 };
    const segments = computeBeamSegments(origin, rotation, 99999);
    console.log(segments.length);

    console.log(`[foundry-beams] updateBeam - Drawing ${segments.length} beam segment(s) for ${token.name}`);

    for (const { start, dx, dy, length } of segments) {
        const container = new PIXI.Container();

        const beam = new PIXI.Sprite(PIXI.Texture.WHITE);
        beam.anchor.set(0, 0.5); // left edge, vertically centered
        beam.height = config.width;
        beam.width = length;
        beam.blendMode = PIXI.BLEND_MODES.ADD;


        const color = hexToRGB(config.colorHex ?? "#ffe699");
        const shader = new PIXI.Filter(null, `
      precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float time;
uniform vec3 beamColor;
uniform float alphaMult;

void main() {
    vec2 uv = vTextureCoord;

    // Beam shape
    float along = uv.x;
    float across = uv.y - 0.5;

    // Distance-based fade
    float fade = 1.0 - clamp(along, 0.0, 1.0);
    float softness = 0.6;
    float beam = smoothstep(softness, 0.0, abs(across)) * fade;

    // Animation pulse (optional)
    float pulse = 0.75 + 0.25 * sin(time * 5.0); // range 0.5–1.0
    beam *= pulse;

    // Sample base (white) texture
    vec4 base = texture2D(uSampler, uv);

    // Final color
    gl_FragColor = base * vec4(beamColor, beam * alphaMult);
}
      `, {
            time: 0,
            beamColor: [1.0, 1.0, 0.5],
            alphaMult: 0.6,
        });

        beam.filters = [shader];
        container.addChild(beam);

        container.x = start.x;
        container.y = start.y;
        container.rotation = Math.atan2(dy, dx);
        canvas.effects.addChild(container);
        existing.containers.push({ container, filter: shader });
        // Add marker at the segment's end (excluding last one)
        //    if (i < segments.length - 1) {
        const endX = start.x + dx;
        const endY = start.y + dy;
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
    // beams.containers[0].container.children[0].vertexData 
    // these are the points of the single rectangle segment to create region
    /*
    at each beam segment in the loop since i have the wall mirror information I can also run the macro
     let macro = game.macros.getName(macro_name);
  if (macro_name && !macro) {
    ui.notifications.warn(MOD_NAME + ": Failed to find macro:" + macro_name);
  }
  if (macro) {
    macro.execute({ token: sensor, light_count: active.size });
  }
    */
}

function computeBeamSegments(origin, rotationDeg, maxDistance) {
    const segments = [];
    let currentPoint = origin;
    let direction = rotationDeg * (Math.PI / 180);
    let bounces = 0;
    const maxBounces = 3;
    let lastCollisionEdgeId = null;


    while (bounces < maxBounces) {
        const dest = Ray.fromAngle(currentPoint.x, currentPoint.y, direction, maxDistance).B;
        let collisions = CONFIG.Canvas.polygonBackends.move.testCollision(currentPoint, dest, {
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
        //}while (collisionElement);
        /*
                if (collisionElement.edges.values().next().value.id == lastCollisionEdgeId) {
                    console.log("we collided with the same starting wall; we reset to dest")
                }
                    */
        let endPoint = collisionElement ?? dest;
        const edgeData = collisionElement.edges.values().next().value;
        /*
        if (edgeData.id == lastCollisionEdgeId) {
            console.log("we collided with the same starting wall; we reset to dest")
            endPoint = dest;
            collision = null;
        }
            */
        console.log(edgeData);

        const dx = endPoint.x - currentPoint.x;
        const dy = endPoint.y - currentPoint.y;
        console.log(`dx: ${dx} | dy: ${dy} `)
        const length = Math.hypot(dx, dy);
        console.log(length);

        segments.push({ start: currentPoint, end: endPoint, dx, dy, length });
        console.log("after wall check");
        // added to solve the imprecision in the collision
        if (collisionElement == null) break;

        // looking id the wall is a mirror
        const isMirror = edgeData?.object?.document.getFlag("foundry-beams", "mirror.isMirror") ?? false;
        //const isMirror = true;
        if (!isMirror) break;
        lastCollisionEdgeId = edgeData.id;

        const A = edgeData.a;
        const B = edgeData.b;

        const wallDX = B.x - A.x;
        const wallDY = B.y - A.y;
        //const wallAngle = Math.atan2(wallDY, wallDX);
        //console.log(`wallAngle ${wallAngle}`)
        // Normalize incident vector
        const incident = { x: dx / length, y: dy / length };
        console.log(incident)
        const wallLength = Math.hypot(wallDX, wallDY);
        console.log(wallLength)
        const wallVec = { x: wallDX / wallLength, y: wallDY / wallLength };
        console.log(wallVec)
        const normal = { x: -wallVec.y, y: wallVec.x }; // perpendicular
        console.log(normal)

        const dot = incident.x * normal.x + incident.y * normal.y;
        console.log(dot)
        const rx = incident.x - 2 * dot * normal.x;
        const ry = incident.y - 2 * dot * normal.y;

        direction = Math.atan2(ry, rx);
        //    const inAngle = Math.atan2(dy, dx);
        //    console.log(`inAngle ${inAngle}`)
        //const incidence = direction - wallAngle;
        //const reflection = wallAngle - incidence;

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
