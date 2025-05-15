# foundry-beams
- ![](https://img.shields.io/badge/Foundry-v12-informational)
- ![Latest Release Download Count](https://img.shields.io/github/downloads/gioppoluca/foundry-beams/latest/module.zip)
- ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Ffoundry-beams&colorB=4aa94a)

# WARNING - This module is still an alpha release in full development - wait until this message is removed to use it properly ... but if you want to have a glimpse of it and share some hints you are welcome

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

1. Edit any wall and find the section where to opt for making the wall
   1. a mirror (all sides become a mirror) 
   2. reactive to beam (will execute the macro names in the input field)


### Automatically Generated Regions (v12)

- Regions can be created to match the full path of a beam.
- Useful for triggering effects, hazards, auras, etc.

## 🧪 API

Other modules can interact via:

```js
const beams = game.modules.get("foundry-beams").api;

// Enable/Disable
await beams.enableBeamById("Token.id");
await beams.disableBeamById("Token.id");

// Set color
await beams.updateBeamColorById("Token.id", "#ff00ff");

// Get state
const state = await beams.getBeamStateById("Token.id");

// Rotate beam
await beams.rotateBeamById("Token.id", 90);

// Generate region
await beams.createRegionFromBeam("Token.id", "hazard");

// Remove regions
await beams.deleteBeamRegions("Token.id");
