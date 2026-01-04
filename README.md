# Cosmic Frontier

Website for [Cosmic Frontier](https://cosmicfrontier.org), built with Astro and Svelte 5. Features interactive 3D space telescope simulations using Three.js.

## Quick start

```bash
npm install
npm run dev
```

Visit `http://localhost:4321` to view the site.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Run Astro type checking
- `npm run format` - Format code with Prettier

## Project structure

- `src/components/` - Svelte components and Three.js simulation code
- `src/pages/` - Astro pages (blog, contact, join-us)
- `src/styles/` - Global styles and design tokens
- `src/site-content/` - Blog posts and CMS content

## Content management

### Blog posts

Create markdown files in `src/site-content/blog/` with frontmatter:

```markdown
---
title: "Post Title"
date: 2024-01-15
category: "Essays"
publishedBy: "Author Name"
publishedDate: 2024-01-20
isDraft: false
---

Your blog post content here...
```

- `title` - Post title (used to generate URL slug)
- `date` - Publication date
- `category` - Post category
- `publishedBy` - Author name (optional)
- `publishedDate` - Publication date (optional)
- `isDraft` - Set to `false` to publish, `true` to hide

### Job postings

Edit `src/site-content/jobs.yaml`:

```yaml
- title: "Job Title"
  location: "San Francisco"
  greenhouseLink: "https://boards.greenhouse.io/company/job-id"
  isDraft: false
```

- `title` - Job title
- `location` - Job location
- `greenhouseLink` - Greenhouse application URL
- `isDraft` - Set to `false` to publish, `true` to hide