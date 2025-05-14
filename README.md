# foundry-beams

A Foundry VTT module that lets tokens emit animated, glowing beam segments — with support for reflections, shader effects, regions, and module API integration.

## ✨ Features

- 🔦 Create directional, pulsing light beams from tokens
- 🔁 Reflect off flagged mirror walls
- 🎨 Fully shader-driven visual effects (custom color, pulse, width)
- 📐 Generates Foundry v12 Region polygons matching the beam's path
- 🔌 Provides API methods for other modules to control beam behavior

## 📦 Installation

Install it as a Foundry VTT module from within the module section.

> Requires **Foundry VTT v12+**

## 🚀 Usage

### Enable Beam on a Token

1. Open token configuration.
2. Use the new **"Beam" tab** to configure:
   - Beam enabled
   - Color (hex)
   - Width

### Make Walls Reflective

1. Edit any wall and click the **"Mirror"** button in its header.
2. When a beam hits this wall, it will reflect based on the wall's angle.

### Automatically Generated Regions (v12)

- Regions can be created to match the full path of a beam.
- Useful for triggering effects, hazards, auras, etc.

## 🧪 API

Other modules can interact via:

```js
const beams = game.modules.get("foundry-beams").api;

// Enable/Disable
await beams.enableBeamByUUID("SceneID.TokenID");
await beams.disableBeamByUUID("SceneID.TokenID");

// Set color
await beams.updateBeamColorByUUID("SceneID.TokenID", "#ff00ff");

// Get state
const state = await beams.getBeamStateByUUID("SceneID.TokenID");

// Rotate beam
await beams.rotateBeamByUUID("SceneID.TokenID", 90);

// Generate region
await beams.createRegionFromBeam("TokenID", "hazard");

// Remove regions
await beams.deleteBeamRegions("TokenID");
