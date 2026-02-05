uniform float uTime;
attribute vec3 aBary;
varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vBary;
varying vec4 vWorldPosition;

const float RIPPLE_PARAM = 5.0;

void main() {
	vUv = uv;
	vBary = aBary;
	vPosition = position;

	vec2 tVec = smoothstep(0.9, 1.0, abs(1.0 - fract(vUv.xy * RIPPLE_PARAM)));
	float t = tVec.x + tVec.y;
	// vPosition.z += t * 0.25 * abs(sin(0.25 * uTime + vUv.x * 10.0 + vUv.y * 10.0)); // Use 0.5 to tamp it down

	vWorldPosition = modelViewMatrix * vec4(vPosition, 1.0);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
}