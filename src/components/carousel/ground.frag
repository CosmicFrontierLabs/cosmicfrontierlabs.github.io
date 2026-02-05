varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vBary;
varying vec4 vWorldPosition;

const float LINE_WIDTH = 1.0;
const vec4 BG_COLOR = vec4(vec3(0.3), 1.0);
const vec4 LINE_COLOR = vec4(vec3(0.6), 1.0);
const vec3 FOG_COLOR = vec3(0.25);
const vec3 CAMERA_POS = vec3(0.0, 0.0, 0.0); // world coordinates

float inverseLerp(float v, float minValue, float maxValue) {
	return (v - minValue) / (maxValue - minValue);
}

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
	float t = inverseLerp(v, inMin, inMax);
	return mix(outMin, outMax, t);
}

void main() {
	// gl_FragColor = vec4(vUv.x, vUv.y, 0.0, 1.0);

	vec3 d = fwidth(vBary);
	vec3 a = smoothstep(vec3(0.0), d * LINE_WIDTH, vBary);
	float t = min(min(a.x, a.y), a.z);

	vec4 col = mix(LINE_COLOR, BG_COLOR, t);

	// Apply fog manually
	// dist from camera
	float dist = length(CAMERA_POS - vWorldPosition.xyz);
	float fogT = saturate(remap(dist, 1.0, 20.0, 0.0, 1.0));
	col = mix(col, vec4(FOG_COLOR, 0.9), fogT);

	gl_FragColor = col;
}