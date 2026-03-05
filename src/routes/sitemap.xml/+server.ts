import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import matter from "gray-matter";
import { slugFromTitle } from "$lib/utils";

const SITE = "https://www.cosmicfrontier.org";

const staticPages = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/contact", changefreq: "monthly", priority: "0.6" },
  { path: "/join-us", changefreq: "monthly", priority: "0.6" },
];

function getBlogPosts(): { path: string; lastmod: string }[] {
  const blogDir = join(process.cwd(), "src/site-content/blog");
  const files = readdirSync(blogDir).filter((f) => f.endsWith(".md"));

  return files
    .map((file) => {
      const raw = readFileSync(join(blogDir, file), "utf-8");
      const { data } = matter(raw);

      if (data.isDraft) return null;

      const slug = slugFromTitle(data.title);
      const date = new Date(data.date);
      return {
        path: `/blog/${slug}`,
        lastmod: date.toISOString().split("T")[0],
      };
    })
    .filter((p): p is { path: string; lastmod: string } => p !== null)
    .sort((a, b) => b.lastmod.localeCompare(a.lastmod));
}

export const prerender = true;

export function GET() {
  const posts = getBlogPosts();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
  .map(
    (page) => `  <url>
    <loc>${SITE}${page.path}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join("\n")}
${posts
  .map(
    (post) => `  <url>
    <loc>${SITE}${post.path}</loc>
    <lastmod>${post.lastmod}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.7</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
