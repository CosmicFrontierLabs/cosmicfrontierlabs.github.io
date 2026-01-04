import * as THREE from "three";

/**
 * Configuration for the simulation component
 *
 * All distance, position, and size values use world space units (arbitrary units
 * consistent within the Three.js scene). The scale is chosen to avoid precision
 * issues, with typical values ranging from 0.01 to 100 units.
 */
export interface SimulationConfig {
  camera: {
    fov: number;
    near: number; // world units
    far: number; // world units
    initialPosition: THREE.Vector3; // world units
    defaultAspect: number;
  };
  scene: {
    backgroundColor: number;
  };
  baseColor: number;
  telescope: {
    targetRadius: number; // world units
    numTelescopes: number;
    numMouseTrackingTelescopes: number;
    angleSpeed: number;
    orbitalRadiusScalar: number; // This multiplies by the earth radius to get the orbital radius
    originRadius: number; // world units
    targetDistance: number; // world units, distance from origin to target along direction vector
    telescopeLength: number; // world units
    telescopeWidth: number; // world units
    frustumTargetSpeed: number; // radians per second
  };
  orbitalMechanics: {
    earthMass: number; // Earth's mass scaled to world units
    gravitationalConstant: number; // Gravitational constant G scaled to world units
  };
  background: {
    geometry: {
      radius: number;
      widthSegments: number;
      heightSegments: number;
    };
    texture: {
      url: string;
    };
    opacity: {
      base: number;
      hover: number;
    };
    circleRadius: number; // world units (converted to NDC in shader)
    maxTelescopes: number;
    brightness: number; // Brightness multiplier (1.0 = normal, >1.0 = brighter)
  };
  controls: {
    disableAll: boolean;
  };
  earth: {
    textureUrl: string;
    radius: number; // world units
    segments: number;
    position: THREE.Vector3; // world units
    rotationSpeed: number;
    roughness: number;
  };
  lighting: {
    ambient: {
      intensity: number;
    };
  };
  perf: {
    enabled: boolean;
  };
}

export const simulationConfig: SimulationConfig = {
  camera: {
    fov: 45,
    near: 0.01, // world units
    far: 100, // world units
    initialPosition: new THREE.Vector3(0, 0, 12), // world units
    defaultAspect: 1.5,
  },
  scene: {
    backgroundColor: 0x03060b,
    // backgroundColor: 0x888888,
  },
  // baseColor: 0x00ff41, // Bright neon CRT green
  // baseColor: 0xfcca8b, // Amber
  // baseColor: 0xfdf3e8, // cream
  baseColor: 0xfcfcfc, // off-white
  background: {
    // We use a spherical geometry that wraps around the scene. We only color
    // the inside of the sphere. The outside of the sphere is transparent.
    // 4 is good for debugging.
    // 50 was the original value for full wrap around but I think that might be too big
    // scale: new THREE.Vector3(20, 20, 20), // world units
    geometry: {
      radius: 1.3, // Base radius, will be scaled
      widthSegments: 64, // Sphere segments for detail (reduced for performance)
      heightSegments: 64, // Sphere segments for detail (reduced for performance)
    },
    texture: {
      url: "/textures/sky1.jpg",
    },
    opacity: {
      base: 0.0, // Lower default opacity for background pixels
      hover: 1.0,
    },
    brightness: 2.5, // Brightness multiplier (1.0 = normal, >1.0 = brighter)
    circleRadius: 0.1, // world units
    maxTelescopes: 30,
  },
  telescope: {
    numTelescopes: 10,
    numMouseTrackingTelescopes: 4,
    originRadius: 0.001, // world units
    targetRadius: 0.04, // world units
    angleSpeed: 0.2, // radians per second
    orbitalRadiusScalar: 1.5, // world units, distance from origin to earth center
    targetDistance: 4, // world units
    telescopeLength: 0.06, // world units
    telescopeWidth: 0.015, // world units
    frustumTargetSpeed: 0.2, // radians per second
  },
  orbitalMechanics: {
    // Scaled values for world units where Earth radius = 1 unit
    // Real values: Earth mass ≈ 5.972×10²⁴ kg, G ≈ 6.674×10⁻¹¹ m³/(kg·s²)
    // For simulation scale: if Earth radius = 1 unit, scale GM to produce realistic orbital periods
    // Hubble orbits at ~547km altitude (r ≈ 1.086 × Earth radius) with ~95 min period
    // Scaled GM chosen to give realistic angular speeds for LEO satellites
    earthMass: 1.0, // Scaled mass (unitless in world space)
    gravitationalConstant: 0.1, // Scaled G (produces realistic orbital speeds)
  },
  controls: {
    disableAll: true,
  },
  earth: {
    // textureUrl: "/textures/earthmap-stylized2.png",
    textureUrl: "/textures/simplearth.png",
    radius: 0.375, // world units
    segments: 32,
    position: new THREE.Vector3(0, 0, 0), // world units
    rotationSpeed: (2 * Math.PI) / 32,
    roughness: 0.7,
  },
  lighting: {
    ambient: {
      intensity: 8,
    },
  },
  perf: {
    enabled: true,
  },
};
