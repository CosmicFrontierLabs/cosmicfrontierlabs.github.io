import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import matter from "gray-matter";
import { slugFromTitle } from "$lib/utils";

const SITE = "https://www.cosmicfrontier.org";
const MAX_DESCRIPTION_LENGTH = 200;

type RssItem = {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  description: string;
  category: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[#>*_~\-]+/g, " ")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBlogPosts(): RssItem[] {
  const blogDir = join(process.cwd(), "src/site-content/blog");
  const files = readdirSync(blogDir).filter((f) => f.endsWith(".md"));

  return files
    .map((file) => {
      const raw = readFileSync(join(blogDir, file), "utf-8");
      const { data, content } = matter(raw);

      if (data.isDraft) return null;

      const slug = slugFromTitle(data.title);
      const url = `${SITE}/blog/${slug}`;
      const description = stripMarkdown(content).slice(0, MAX_DESCRIPTION_LENGTH).trim();

      return {
        title: data.title as string,
        link: url,
        guid: url,
        pubDate: new Date(data.date).toUTCString(),
        description,
        category: (data.category as string) ?? "Blog",
      };
    })
    .filter((p): p is RssItem => p !== null)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
}

export const prerender = true;

export function GET() {
  const posts = getBlogPosts();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Cosmic Frontier Labs Blog</title>
    <link>${SITE}/blog</link>
    <description>Updates from Cosmic Frontier Labs</description>
    <language>en-us</language>
    ${posts
      .map(
        (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(post.link)}</link>
      <guid isPermaLink="true">${escapeXml(post.guid)}</guid>
      <pubDate>${escapeXml(post.pubDate)}</pubDate>
      <description>${escapeXml(post.description)}</description>
      <category>${escapeXml(post.category)}</category>
    </item>`
      )
      .join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml",
    },
  });
}
