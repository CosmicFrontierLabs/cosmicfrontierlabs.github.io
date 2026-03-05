#!/usr/bin/env bash
set -euo pipefail

for file in public/models/original/*.glb; do
  name=$(basename "$file")
  echo "Processing $name..."
  gltf-transform weld "$file" /tmp/welded.glb
  gltf-transform simplify /tmp/welded.glb /tmp/simplified.glb --ratio 0.1 --error 0.001

  # Original
  # gltf-transform optimize /tmp/simplified.glb "public/models/$name" --compress meshopt

  # Keep meshes and mesh names
  gltf-transform optimize /tmp/simplified.glb "public/models/$name" --compress meshopt --join false --flatten false
done
