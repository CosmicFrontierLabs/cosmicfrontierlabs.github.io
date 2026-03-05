# Cosmic Frontier

Website for [Cosmic Frontier](https://cosmicfrontier.org), built with SvelteKit and Svelte 5. Features interactive 3D space telescope simulations using Three.js. Deployed as a static site on GitHub Pages.

## Quick start

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to view the site.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Run svelte-check type checking
- `npm run format` - Format code with Prettier

## Project structure

- `src/components/` - Svelte components and Three.js simulation code
- `src/routes/` - SvelteKit routes (blog, contact, join-us)
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

### Carousel slides

Edit `src/site-content/carousel.yaml`. Each entry defines one slide in the 3D telescope carousel on the home page:

```yaml
- title: "Slide Title"
  description: "One to three sentences of explanatory text."
  model: "payload"
  camera:
    position: { x: 3, y: 1.5, z: 3 }
    lookAt: { x: 0.5, y: 1, z: 0 }
```

- `title` - Short heading shown in the overlay panel (40 chars max)
- `description` - Explanatory text (250 chars max)
- `model` - Which GLB model to show (named in `MODEL_CONFIGS` in `CarouselScene.ts`)
- `camera.position` - Where the camera sits (x, y, z)
- `camera.lookAt` - Where the camera points (x, y, z). Keep near the model center (~0, 0.5, 0) and vary position to orbit around it.

Slides auto-advance in order, so arrange them to tell a coherent story. Max 8 slides without layout adjustments. Type definition: `CarouselItem` in `src/lib/types.ts`.

## 3D Model Optimization

GLB models in `public/models/` are optimized for web delivery using [`gltf-transform`](https://gltf-transform.dev/). The original CAD exports from SolidWorks are extremely large (96–275 MB each) and need to be processed before use on the site.

### How to optimize a new model

Install the CLI tool (one-time):

```bash
npm install -g @gltf-transform/cli
```

Run the three-step pipeline — **weld** (merge split vertices), **simplify** (decimate mesh), **optimize** (compress with meshopt):

```bash
# Step 1: Weld nearby vertices (helps the simplifier work better)
gltf-transform weld input.glb /tmp/welded.glb

# Step 2: Simplify — reduce to ~10% of triangles, constrained to 0.1% geometric error
gltf-transform simplify /tmp/welded.glb /tmp/simplified.glb --ratio 0.1 --error 0.001

# Step 3: Optimize — dedup, flatten, compress with meshopt
gltf-transform optimize /tmp/simplified.glb public/models/output.glb --compress meshopt
```

**Tuning tips:**

- `--ratio 0.1` = keep 10% of triangles. Increase to 0.2–0.3 if the model looks too degraded.
- `--error 0.001` = max 0.1% geometric error. The simplifier stops early if this threshold is hit.
- Preview results at https://gltf-viewer.donmccurdy.com/ before committing.
- Models already compressed with Draco (like `tree.glb`) may get _larger_ through this pipeline — skip them.

### Compression format

The optimized models use **meshopt** compression (via `EXT_meshopt_compression`). The GLTFLoader in `CarouselScene.ts` is configured with both `MeshoptDecoder` and `DRACOLoader` to handle both formats.

### Original files

Unoptimized originals are backed up in `public/models/original/` (git-ignored). Keep these around in case you need to re-optimize with different settings.

## HDR Environment Texture Optimization

Downloaded from https://www.spacespheremaps.com/hdr-spheremaps/

The HDR environment background (`public/textures/HDR_multi_nebulae_1_4k.hdr`) is downscaled from the original 10000×5000 (89 MB) to 4096×2048 (25 MB) — a **72% reduction**.

The carousel-bg.jpg, which is actually used was generated with: `magick HDR_multi_nebulae_1_4k.hdr -colorspace sRGB -quality 95 carousel-bg.jpg`

### How to re-optimize the HDR texture

The original is backed up in `public/textures/original/` (git-ignored). To regenerate:

```bash
# Downscale to 4096×2048 using ImageMagick
magick public/textures/original/HDR_multi_nebulae_1.hdr \
  -resize 4096x2048 \
  public/textures/HDR_multi_nebulae_1_4k.hdr
```

**Tuning tips:**

- Use `2048x1024` for a smaller file (~6.5 MB) if bandwidth is a concern.
- `4096x2048` is a good balance between quality and file size.
- The original 10K×5K file is only needed for re-processing; keep it in `public/textures/original/` but don't commit it.
