# Cosmic Frontier

Website for [Cosmic Frontier](https://cosmicfrontier.org), built with Astro and Svelte 5. Features interactive 3D space telescope simulations using Three.js.

---

TODO:

- Improve the loading experience, especially in Canvas and probably onMount in there: What's slow, What can be deferred
  - Maybe start by adding logging to onMount in canvas
  - Need to do this BEFORE sending to aaron because it looks slow
  - Preload HDR after hero Three.js scene is running ?
- There's an issue with OverlayComponent's fade in. It fades in the flashes out and back in on scroll.
- What happens if graphics acceleration is disabled?
- What happens if the internet is super slow? What's our fallback?
- Make sure mobile view looks good
- Explore mouse effect on hero
- More gap between rolodex cards in desktop viewport
- Make sure carousel resets to 0 on entry to viewport
- Race condition on fast scroll — if a user scrolls quickly past the content sections to the carousel anchor before GLB models load, the carousel scene renders with potentially incomplete geometry.
  Whether this is visually noticeable depends on how CarouselScene.update/render handles missing models.
- Check A11y
- Check lighthouse
- Optional:
  - Consider adding gradients via https://www.goodcomponents.io/components/animated-mesh-gradient

## It's mesh_0_55

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

## 3D Model Optimization

GLB models in `public/models/` are optimized for web delivery using [`gltf-transform`](https://gltf-transform.dev/). The original CAD exports from SolidWorks are extremely large (96–275 MB each) and need to be processed before use on the site.

### Optimization results

| Model                                 | Original | Optimized | Reduction                 |
| ------------------------------------- | -------- | --------- | ------------------------- |
| `20260102_Payload_assy_no_baffle.glb` | 96 MB    | 1.8 MB    | 98%                       |
| `20260102_Payload_assy.glb`           | 97 MB    | 1.9 MB    | 98%                       |
| `20260102_Full_Assy_no_mli.glb`       | 206 MB   | 3.5 MB    | 98%                       |
| `20260102_Full_Assy.glb`              | 206 MB   | 3.5 MB    | 98%                       |
| `batmobile.glb`                       | 275 MB   | 1.6 MB    | 99%                       |
| `tree.glb`                            | 5.2 MB   | 5.2 MB    | already optimized (Draco) |

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

## Dev notes

The canvasOpacity must control if anything in Canvas.svelte and it's children are visible
That's what must determine whether the loader of carousel or hero animation are visible.

That doesn't look great on slow 4g because it requires all the js to load, so need to think about it a bit more. and what my preferred pattern is for htis kind of thing.
probably a pen and paper think for a sec.
