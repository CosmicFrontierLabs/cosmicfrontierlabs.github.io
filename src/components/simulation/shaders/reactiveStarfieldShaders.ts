import { simulationConfig } from "../simulationConfig";

/**
 * Background vertex shader
 * Simplified version - basic pass-through for sphere geometry
 * Complex displacement/animation code commented out for now
 */
export const vertexShader = `
  varying vec2 vUv;
  varying vec4 vClipPosition;

  void main() {
    vUv = uv;
    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vClipPosition = clipPos;
    gl_Position = clipPos;
  }
`;

/**
 * Generate the background fragment shader with dynamic array sizes.
 * Array sizes are derived from simulationConfig.background.maxTelescopes.
 */
function createFragmentShader(): string {
  const maxTargets = simulationConfig.background.maxTelescopes;
  const maxIntersections = maxTargets * 2; // 2 intersection points per frustum

  return `
  uniform vec2 uFrustumTargets[${maxTargets}]; // Support up to ${maxTargets} frustum targets
  uniform vec2 uFrustumIntersections[${maxIntersections}]; // Support up to ${maxIntersections} intersection points (2 per frustum)
  uniform int uFrustumCount;
  uniform int uFrustumIntersectionCount;
  uniform float uRadius;
  uniform vec2 uResolution;
  uniform sampler2D uTexture;
  uniform float uOpacityBase;
  uniform float uOpacityHover;
  uniform float uBrightness; // Brightness multiplier for texture
  
  varying vec2 vUv;
  varying vec4 vClipPosition;
  
  void main() {
    // Convert clip position to screen space (NDC)
    vec2 screenPos = vClipPosition.xy / vClipPosition.w;
    float aspect = uResolution.x / uResolution.y;
    
    // Sample texture for entire sphere surface
    vec4 texColor = texture2D(uTexture, vUv);
    
    // Apply brightness multiplier to RGB channels
    vec3 brightColor = texColor.rgb * uBrightness;
    
    // Start with base opacity
    float opacity = uOpacityBase;
    float maxOpacityFactor = 0.0;
    
    // Increase opacity near frustum destinations
    if (uFrustumCount > 0) {
      for (int i = 0; i < ${maxTargets}; i++) {
        if (i >= uFrustumCount) break;
        vec2 diff = screenPos - uFrustumTargets[i];
        diff.x *= aspect; // Aspect ratio correction
        float dist = length(diff);
        float destOpacityFactor = 1.0 - smoothstep(0.0, uRadius, dist);
        maxOpacityFactor = max(maxOpacityFactor, destOpacityFactor);
      }
    }
    
    // Increase opacity near intersection points (where frustums intersect the background)
    if (uFrustumIntersectionCount > 0) {
      for (int i = 0; i < ${maxIntersections}; i++) {
        if (i >= uFrustumIntersectionCount) break;
        vec2 diff = screenPos - uFrustumIntersections[i];
        diff.x *= aspect; // Aspect ratio correction
        float dist = length(diff);
        float intersectionOpacityFactor = 1.0 - smoothstep(0.0, uRadius, dist);
        maxOpacityFactor = max(maxOpacityFactor, intersectionOpacityFactor);
      }
    }
    
    // Interpolate opacity between base and hover based on proximity to frustums
    opacity = mix(uOpacityBase, uOpacityHover, maxOpacityFactor);
    
    // Apply opacity to brightened texture color
    gl_FragColor = vec4(brightColor, opacity);
  }
`;
}

/**
 * Background fragment shader
 * Generated dynamically based on simulationConfig.background.maxTelescopes
 */
export const fragmentShader = createFragmentShader();
