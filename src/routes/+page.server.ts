import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import type { CarouselItem } from "$lib/types";

export function load() {
  const carouselYamlPath = join(process.cwd(), "src/site-content/carousel.yaml");
  const carouselFile = readFileSync(carouselYamlPath, "utf-8");
  const parsed = yaml.load(carouselFile);
  const carouselData = Array.isArray(parsed) ? (parsed as CarouselItem[]) : [];

  return { carouselData };
}
