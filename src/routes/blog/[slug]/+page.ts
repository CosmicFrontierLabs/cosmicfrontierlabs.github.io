import { error } from "@sveltejs/kit";
import { slugFromTitle } from "$lib/utils";
import type { Component } from "svelte";

type MdsvexModule = {
  default: Component;
  metadata: {
    title: string;
    date: string;
    category: string;
    isDraft?: boolean;
  };
};

const allPosts = import.meta.glob("/src/site-content/blog/*.md", { eager: true }) as Record<string, MdsvexModule>;

function getPosts() {
  const posts: Array<{ slug: string; metadata: MdsvexModule["metadata"]; component: Component }> = [];

  for (const [, mod] of Object.entries(allPosts)) {
    if (mod.metadata.isDraft) continue;
    const slug = slugFromTitle(mod.metadata.title);
    posts.push({ slug, metadata: mod.metadata, component: mod.default });
  }

  return posts;
}

export function entries() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export function load({ params }: { params: { slug: string } }) {
  const posts = getPosts();
  const post = posts.find((p) => p.slug === params.slug);

  if (!post) {
    error(404, "Post not found");
  }

  return {
    component: post.component,
    title: post.metadata.title,
    date: post.metadata.date,
  };
}
