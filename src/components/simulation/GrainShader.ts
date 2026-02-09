import * as THREE from "three";
// @ts-expect-error: no type definitions for 'glslify'
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used as tagged template literal below
import glslify from "glslify";
// Mark glslify as used so Vite doesn't warn about unused import
// (it's used as a tagged template literal for GrainShader.fragmentShader)
void glslify;

export const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1024, 1024) },
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: glslify(`
    #pragma glslify: grain = require(glsl-film-grain)

    #define GRAIN_SIZE 0.1
    #define GRAIN_AMOUNT 0.01

    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;

    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      vec3 shiftedColor = color.rgb;
      float g = grain(vUv, uResolution / GRAIN_SIZE);
      shiftedColor += (g - 0.5) * GRAIN_AMOUNT;
      gl_FragColor = vec4(shiftedColor, color.a);
    }
  `),
};
