import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import matter from "gray-matter";
import { slugFromTitle } from "$lib/utils";

type BlogMeta = {
  title: string;
  date: string;
  slug: string;
  url: string;
};

export function load() {
  const blogDir = join(process.cwd(), "src/site-content/blog");
  const files = readdirSync(blogDir).filter((f) => f.endsWith(".md"));

  const posts: BlogMeta[] = files
    .map((file) => {
      const raw = readFileSync(join(blogDir, file), "utf-8");
      const { data } = matter(raw);

      if (data.isDraft) return null;

      const slug = slugFromTitle(data.title);
      return {
        title: data.title as string,
        date: new Date(data.date).toISOString(),
        slug,
        url: `/blog/${slug}`,
      };
    })
    .filter((p): p is BlogMeta => p !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { posts };
}
