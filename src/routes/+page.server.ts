import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import type { CarouselItem, CarouselItemRaw } from "$lib/types";

type Vec3 = { x: number; y: number; z: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVec3(value: unknown): value is Vec3 {
  if (!isRecord(value)) return false;
  return typeof value.x === "number" && typeof value.y === "number" && typeof value.z === "number";
}

function toOptionalString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function toCarouselItem(value: unknown): CarouselItem | null {
  if (!isRecord(value)) return null;

  const raw = value as CarouselItemRaw;
  const model = typeof raw.model === "string" ? raw.model : null;
  const camera = raw.camera;

  if (!model || !camera || !isVec3(camera.position) || !isVec3(camera.lookAt)) {
    return null;
  }

  return {
    title: toOptionalString(raw.title),
    description: toOptionalString(raw.description),
    model,
    camera: {
      position: camera.position,
      lookAt: camera.lookAt,
    },
  };
}

export function load() {
  const carouselYamlPath = join(process.cwd(), "src/site-content/carousel.yaml");
  const carouselFile = readFileSync(carouselYamlPath, "utf-8");
  const parsed = yaml.load(carouselFile);

  const carouselData = Array.isArray(parsed)
    ? parsed.map((item) => toCarouselItem(item)).filter((item): item is CarouselItem => item !== null)
    : [];

  return { carouselData };
}
