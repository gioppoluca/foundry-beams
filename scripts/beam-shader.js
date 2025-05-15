import { MOD_NAME } from "./beams-const.js";
// Beam Manager-normal-fade with support for switching between basic and normal-fade shader beam rendering

export function createNormalBasedShaderBeam({ start, dx, dy, length, normal, config }) {
  const container = new PIXI.Container();

  const geometry = new PIXI.Geometry()
    .addAttribute('aVertexPosition', [
      0, -config.width / 2,
      length, -config.width / 2,
      length, config.width / 2,
      0, config.width / 2
    ], 2)
    .addAttribute('aTextureCoord', [0, 0, 1, 0, 1, 1, 0, 1], 2)
    .addIndex([0, 1, 2, 0, 2, 3]);

  const colorVec = hexToRGB(config.colorHex ?? "#ffe699");

  const fragmentShaderCode = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform vec2 uNormal;

    void main() {
      vec2 uv = vTextureCoord;
      vec2 centered = uv - vec2(0.5);
      float dist = abs(dot(centered, uNormal));
      float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
      float alpha = smoothstep(0.5, 0.0, dist) * pulse * uIntensity;
      gl_FragColor = vec4(uColor * alpha, alpha);
    }
  `;

  const program = new PIXI.Program(undefined, fragmentShaderCode);
  const shader = new PIXI.Shader(program, {
    uTime: 0,
    uColor: colorVec,
    uIntensity: 1.0,
    uNormal: new Float32Array(normal)
  });

  const material = new PIXI.MeshMaterial(shader);
  const mesh = new PIXI.Mesh(geometry, material);
  mesh.position.set(start.x, start.y);
  mesh.rotation = Math.atan2(dy, dx);

  container.addChild(mesh);
  return { container, filter: shader };
}

export function createBasicShaderBeam({ start, dx, dy, length, config }) {
  const container = new PIXI.Container();

  const beam = new PIXI.Sprite(PIXI.Texture.WHITE);
  beam.anchor.set(0, 0.5);
  beam.width = length;
  beam.height = config.width;
  beam.blendMode = PIXI.BLEND_MODES.ADD;

  const color = hexToRGB(config.colorHex ?? "#ffe699");
  beam.tint = color;
  const blur = new PIXI.filters.BlurFilter();
  blur.blur = 4; // increase for more softness
  /*
  const glow = new PIXI.filters.GlowFilter({
    distance: 15,
    outerStrength: 2,
    innerStrength: 0,
    color: 0xffe699,
    quality: 0.5
  });
  */
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

  //beam.filters = [shader];
  beam.filters = [blur];
  container.addChild(beam);
  container.position.set(start.x, start.y);
  container.rotation = Math.atan2(dy, dx);

  return { container, filter: shader };
}

export function buildBeamSegment({ segment, config, useNormalShader = false }) {
  if (useNormalShader) {
    return createNormalBasedShaderBeam({
      start: segment.start,
      dx: segment.dx,
      dy: segment.dy,
      length: segment.length,
      normal: segment.normal,
      config
    });
  } else {
    return createBasicShaderBeam({
      start: segment.start,
      dx: segment.dx,
      dy: segment.dy,
      length: segment.length,
      config
    });
  }
}

function hexToRGB(hex) {
  const bigint = parseInt(hex.replace("#", ""), 16);
  return [
    ((bigint >> 16) & 255) / 255,
    ((bigint >> 8) & 255) / 255,
    (bigint & 255) / 255
  ];
}
