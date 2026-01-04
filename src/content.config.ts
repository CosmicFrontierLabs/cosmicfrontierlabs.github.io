// 1. Import utilities from `astro:content`
import { defineCollection, z } from "astro:content";

import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/site-content/blog" }),
  schema: z
    .object({
      title: z.string().trim(),
      date: z.date(),
      category: z.string(),
      publishedBy: z.string().optional(),
      publishedDate: z.date().optional(),
      isDraft: z.boolean().optional().default(false),
    })
    .transform((data) => ({
      ...data,
      slug: data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
    }))
    .transform((data) => ({
      ...data,
      url: `/blog/${data.slug}`,
    })),
});

export const collections = { blog };
