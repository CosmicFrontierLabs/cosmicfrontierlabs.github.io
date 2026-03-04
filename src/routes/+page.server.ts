import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import type { CarouselItem } from "$lib/types";

export function load() {
  const carouselYamlPath = join(process.cwd(), "src/site-content/carouselData.yaml");
  const carouselFile = readFileSync(carouselYamlPath, "utf-8");
  const carouselData = yaml.load(carouselFile) as CarouselItem[];

  return { carouselData };
}
