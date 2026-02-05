varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vBary;
varying vec4 vWorldPosition;

uniform vec3 uGradientTop;
uniform vec3 uGradientBottom;
uniform float uWireframeOpacity;
uniform float uTime;

const float LINE_WIDTH = 1.0;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float hash2(vec2 p) {
	return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453123);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));
	
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Seamless noise for spherical UVs - blends across the horizontal seam
float seamlessNoise(vec2 uv, float scale) {
	// Wrap uv.x to handle values outside [0,1] from offsets
	float wrappedX = fract(uv.x);
	vec2 p = vec2(wrappedX, uv.y) * scale;
	
	// Blend near the horizontal seam (uv.x near 0 or 1)
	float blendWidth = 0.1;
	float blendFactor = 0.0;
	
	if (wrappedX < blendWidth) {
		blendFactor = 1.0 - wrappedX / blendWidth;
	} else if (wrappedX > 1.0 - blendWidth) {
		blendFactor = (wrappedX - (1.0 - blendWidth)) / blendWidth;
	}
	
	float n1 = noise(p);
	
	if (blendFactor > 0.0) {
		// Sample wrapped position
		vec2 wrappedP = vec2(p.x + scale, p.y);
		if (wrappedX > 0.5) {
			wrappedP = vec2(p.x - scale, p.y);
		}
		float n2 = noise(wrappedP);
		return mix(n1, n2, blendFactor * 0.5);
	}
	
	return n1;
}

// Reduced octave fbm for better performance
float fbm3(vec2 p) {
	float value = 0.0;
	float amplitude = 0.5;
	value += amplitude * noise(p); amplitude *= 0.5; p *= 2.0;
	value += amplitude * noise(p); amplitude *= 0.5; p *= 2.0;
	value += amplitude * noise(p);
	return value;
}

float fbm4(vec2 p) {
	float value = 0.0;
	float amplitude = 0.5;
	value += amplitude * noise(p); amplitude *= 0.5; p *= 2.0;
	value += amplitude * noise(p); amplitude *= 0.5; p *= 2.0;
	value += amplitude * noise(p); amplitude *= 0.5; p *= 2.0;
	value += amplitude * noise(p);
	return value;
}

// Seamless fbm for spherical UV coordinates
float fbm3Seamless(vec2 uv, float baseScale) {
	float value = 0.0;
	float amplitude = 0.5;
	float scale = baseScale;
	value += amplitude * seamlessNoise(uv, scale); amplitude *= 0.5; scale *= 2.0;
	value += amplitude * seamlessNoise(uv, scale); amplitude *= 0.5; scale *= 2.0;
	value += amplitude * seamlessNoise(uv, scale);
	return value;
}

float fbm4Seamless(vec2 uv, float baseScale) {
	float value = 0.0;
	float amplitude = 0.5;
	float scale = baseScale;
	value += amplitude * seamlessNoise(uv, scale); amplitude *= 0.5; scale *= 2.0;
	value += amplitude * seamlessNoise(uv, scale); amplitude *= 0.5; scale *= 2.0;
	value += amplitude * seamlessNoise(uv, scale); amplitude *= 0.5; scale *= 2.0;
	value += amplitude * seamlessNoise(uv, scale);
	return value;
}

vec3 starField(vec2 uv, float density, float brightness, float driftSpeed) {
	// Subtle parallax drift based on density (distant stars move slower)
	vec2 drift = vec2(uTime * driftSpeed * 0.01, uTime * driftSpeed * 0.005);
	vec2 scaledUv = uv * density + drift * density;
	
	vec2 gridPos = floor(scaledUv);
	vec2 gridUv = fract(scaledUv);
	
	vec3 star = vec3(0.0);
	float randVal = hash(gridPos);
	
	if (randVal > 0.95) {
		vec2 starCenter = vec2(hash(gridPos + 1.0), hash(gridPos + 2.0));
		float dist = length(gridUv - starCenter);
		
		float twinkle = sin(uTime * (0.8 + randVal * 3.0) + randVal * 6.28) * 0.5 + 0.5;
		float size = 0.015 + randVal * 0.02;
		float intensity = smoothstep(size, 0.0, dist) * brightness * twinkle;
		
		float temp = hash2(gridPos);
		vec3 starColor;
		if (temp < 0.3) {
			starColor = vec3(0.7, 0.8, 1.0);
		} else if (temp < 0.7) {
			starColor = vec3(1.0, 1.0, 0.95);
		} else {
			starColor = vec3(1.0, 0.85, 0.7);
		}
		
		if (randVal > 0.99) {
			float glow = smoothstep(size * 5.0, 0.0, dist) * 0.4;
			intensity += glow;
		}
		
		star = starColor * intensity;
	}
	
	return star;
}

vec3 nebula(vec2 uv) {
	vec2 uv1 = uv + vec2(uTime * 0.008, 0.0);
	vec2 uv2 = uv + vec2(-uTime * 0.006, 0.0);
	float n1 = fbm3Seamless(uv1, 2.5);
	float n2 = fbm3Seamless(uv2, 3.0);
	
	// Pulsing brightness
	float pulse = sin(uTime * 0.3) * 0.15 + 0.85;
	
	// Subtle color shifting over time
	vec3 color1 = vec3(0.5 + sin(uTime * 0.1) * 0.1, 0.1, 0.7 + cos(uTime * 0.08) * 0.1);
	vec3 color2 = vec3(0.1, 0.25 + sin(uTime * 0.12) * 0.05, 0.7);
	
	vec3 nebula1 = color1 * pow(n1, 2.0) * 0.4 * pulse;
	vec3 nebula2 = color2 * pow(n2, 2.2) * 0.35;
	
	return nebula1 + nebula2;
}

vec3 milkyWay(vec2 uv) {
	// Use wrapped x for seamless band calculation
	float wrappedX = fract(uv.x);
	
	// Gentle undulation of the band position
	float wave = sin(wrappedX * 3.0 * 6.28 + uTime * 0.15) * 0.02;
	float band = 1.0 - abs(uv.y - wrappedX * 0.25 - 0.35 + wave);
	band = smoothstep(0.3, 0.85, band);
	band = pow(band, 0.8);
	
	vec2 dustUv = uv + vec2(uTime * 0.003, uTime * 0.001);
	float dust = fbm4Seamless(dustUv, 8.0);
	float milky = band * dust * 0.45;
	
	// Breathing effect
	float breathe = sin(uTime * 0.2) * 0.1 + 0.9;
	
	vec3 color = vec3(0.65, 0.55, 0.8) * milky * 0.3 * breathe;
	color += vec3(0.85, 0.8, 0.95) * band * pow(dust, 2.5) * 0.25;
	
	return color;
}

vec3 spiralGalaxy(vec2 uv, vec2 center, float size, float rotation) {
	vec2 p = (uv - center) / size;
	float r = length(p);
	
	if (r > 1.0) return vec3(0.0);
	
	float a = atan(p.y, p.x) + rotation;
	float spiral = sin(a * 2.0 - r * 8.0 + uTime * 0.08) * 0.5 + 0.5;
	float core = exp(-r * 4.0);
	float disk = exp(-r * 2.0) * (1.0 - r);
	
	float galaxy = core * 0.7 + disk * spiral * 0.35;
	galaxy *= smoothstep(1.0, 0.7, r);
	
	vec3 color = mix(vec3(0.8, 0.7, 1.0), vec3(1.0, 0.9, 0.8), r);
	return color * galaxy * 0.12;
}

void main() {
	vec3 spaceColor = mix(uGradientBottom, uGradientTop, pow(vUv.y, 0.8));
	
	spaceColor += milkyWay(vUv);
	spaceColor += nebula(vUv);
	
	// Single spiral galaxy instead of 3
	spaceColor += spiralGalaxy(vUv, vec2(0.15, 0.7), 0.08, 0.5);
	
	// Reduced star layers (3 instead of 5) with parallax drift
	spaceColor += starField(vUv, 35.0, 0.9, 0.3);
	spaceColor += starField(vUv + 0.3, 80.0, 0.5, 0.15);
	spaceColor += starField(vUv + 0.6, 180.0, 0.25, 0.05);
	
	// Simple vignette
	float vignette = 1.0 - length(vUv - 0.5) * 0.25;
	spaceColor *= vignette;

	gl_FragColor = vec4(spaceColor, 1.0);
}
