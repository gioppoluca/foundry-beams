// foundry-beams-region.js — generate and manage regions based on beam paths using `beams` map

import { beams } from './beamManager.js';


export async function createRegionFromSegments(segments, token) {
    let allPoints = []
    console.log("region")
    console.log(token)
    console.log("|||||| SEGMENTS")
    let shapes = []
    const width = token.document.getFlag("foundry-beams", "beam")?.width ?? 20;
    for (const segment of segments) {
        console.log(segment)
        const vertexData = getRectanglePointsFromSegment(segment, width)
console.log("vertexdata")
        console.log(vertexData)
        shapes.push({ type: "polygon", points: vertexData })
        //allPoints.push(...vertexData)
    }
    const regionName = `Beam-${token.name}-Region`;
    let region = game.scenes.viewed.regions.getName(regionName)
    if (region) {
        // region exists so we need to update shapes
        await region.update({ shapes: shapes })
    } else {
        // is a new region
        const regionData = {
            shapes: shapes,
            name: `Beam-${token.name}-Region`,
            visibility: 2,
            x: 0,
            y: 0
        };
        //    const region = await RegionDocument.create(regionData, { parent: canvas.scene });
        console.log(regionData)
        await canvas.scene.createEmbeddedDocuments("Region", [regionData])
    }
    //const rawPoints = Array.from(allPoints);

    console.log(`[foundry-beams] Created region for beam of token ${token.name}`);
}


/**
 * Computes the 4 corner points of the rectangle from a beam segment.
 * @param {object} segment - beam segment with { start, dx, dy, nx, ny }
 * @param {number} width - full width of the beam
 * @returns {number[]} - flattened [x1, y1, x2, y2, x3, y3, x4, y4]
 */
function getRectanglePointsFromSegment(segment, width) {
    const { start, end, dx, dy, normal, ny } = segment;
    const halfWidth = width / 2;
    console.log(width)
    console.log(start)
    console.log(end)
    console.log(normal)

    return [
        start.x + normal[0] * halfWidth, start.y + normal[1] * halfWidth,
        start.x - normal[0] * halfWidth, start.y - normal[1] * halfWidth,
        end.x - normal[0] * halfWidth, end.y - normal[1] * halfWidth,
        end.x + normal[0] * halfWidth, end.y + normal[1] * halfWidth
    ];
}

/**
 * Create a RegionDocument that covers all beam segments of a token.
 * Adds one polygon region with all segment rectangles combined.
 */
export async function createRegionFromBeam(tokenId, behavior = "") {
    const beamData = beams.get(tokenId);
    if (!beamData || !beamData.containers?.length) {
        console.warn(`[foundry-beams] No active beam segments for token ID ${tokenId}`);
        return;
    }

    const token = canvas.tokens.get(tokenId);
    if (!token) {
        console.warn(`[foundry-beams] Token ${tokenId} not found on canvas.`);
        return;
    }

    const width = token.getFlag("foundry-beams", "beam")?.width ?? 20;
    const allPoints = [];

    for (const segment of beamData.containers) {
        const mesh = segment.container;
        if (!mesh || !mesh.width || !mesh.height) continue;
        const start = { x: mesh.x, y: mesh.y };
        const length = mesh.width;
        const dx = Math.cos(mesh.rotation) * length;
        const dy = Math.sin(mesh.rotation) * length;

        const rect = buildRectangleVertices(start, dx, dy, length, width);
        allPoints.push(...rect);
    }

    const flatPoints = allPoints.flat();
    const regionData = {
        x: 0,
        y: 0,
        shape: {
            type: "polygon",
            points: flatPoints
        },
        flags: {
            "foundry-beams": {
                fromToken: token.id,
                behavior
            }
        },
        name: `Beam-${token.name}-Region`,
        hidden: false
    };

    const region = await RegionDocument.create(regionData, { parent: canvas.scene });
    console.log(`[foundry-beams] Created region for beam of token ${token.name}`);
    return region;
}

/**
 * Build rectangle points around a beam segment.
 * Returns 4 points: [ [x1, y1], [x2, y2], [x3, y3], [x4, y4] ]
 */
function buildRectangleVertices(start, dx, dy, length, width) {
    const nx = -dy / length;
    const ny = dx / length;
    const halfW = width / 2;

    return [
        [start.x + nx * halfW, start.y + ny * halfW],
        [start.x - nx * halfW, start.y - ny * halfW],
        [start.x + dx - nx * halfW, start.y + dy - ny * halfW],
        [start.x + dx + nx * halfW, start.y + dy + ny * halfW]
    ];
}

/**
 * Remove all regions created by a beam from a token.
 */
export async function deleteBeamRegions(tokenId) {
    const regions = canvas.scene.regions.filter(r => r.getFlag("foundry-beams", "fromToken") === tokenId);
    const idsToDelete = regions.map(r => r.id);
    if (idsToDelete.length > 0) {
        await canvas.scene.deleteEmbeddedDocuments("Region", idsToDelete);
        console.log(`[foundry-beams] Deleted ${idsToDelete.length} beam regions for token ID ${tokenId}`);
    }
}
