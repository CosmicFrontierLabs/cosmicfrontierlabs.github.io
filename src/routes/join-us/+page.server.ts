import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";

type DescriptionBlock = { type: "paragraph"; text: string } | { type: "list"; items: string[] };

type Position = {
  title: string;
  location: string;
  description: string;
  isDraft?: boolean;
};

type ParsedPosition = Omit<Position, "description"> & { descriptionBlocks: DescriptionBlock[] };

const parseDescription = (description: string): DescriptionBlock[] => {
  const blocks: DescriptionBlock[] = [];
  const lines = description.split(/\r?\n/);
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(" ").trim();
    if (text) blocks.push({ type: "paragraph", text });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      listItems.push(line.slice(2).trim());
      continue;
    }
    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
};

const rot13 = (str: string) =>
  str.replace(/[a-zA-Z]/g, (c) =>
    String.fromCharCode((c <= "Z" ? 90 : 122) >= c.charCodeAt(0) + 13 ? c.charCodeAt(0) + 13 : c.charCodeAt(0) - 13)
  );

export function load() {
  const jobsYamlPath = join(process.cwd(), "src/site-content/jobs.yaml");
  const jobsFile = readFileSync(jobsYamlPath, "utf-8");
  const allPositions = yaml.load(jobsFile) as Position[];

  const positions: ParsedPosition[] = allPositions
    .filter((p) => !p.isDraft)
    .map((position) => ({
      title: position.title,
      location: position.location,
      descriptionBlocks: parseDescription(position.description),
    }));

  const obfuscatedEmail = rot13("jobs@cosmicfrontier.org");
  const keyword = "LANIAKEA";

  return { positions, obfuscatedEmail, keyword };
}
