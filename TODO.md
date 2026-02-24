TODO:

- Preload HDR after hero Three.js scene is running ?
- There's an issue with OverlayComponent's fade in. It fades in the flashes out and back in on scroll.
- What happens if graphics acceleration is disabled?
- What happens if the internet is super slow? What's our fallback?
- Make sure mobile view looks good
- Explore mouse effect on hero
- More gap between rolodex cards in desktop viewport
- Make sure carousel resets to 0 on entry to viewport
- Race condition on fast scroll — if a user scrolls quickly past the content sections to the carousel anchor before GLB models load, the carousel scene renders with potentially incomplete geometry.
- Remove console.log statements
  Whether this is visually noticeable depends on how CarouselScene.update/render handles missing models.
- Check A11y
- Check lighthouse
- Optional:
  - Consider adding gradients via https://www.goodcomponents.io/components/animated-mesh-gradient
- Document the (a) loading pattern (b) error pattern, (c) scroll pattern and architecture so it's understood and reuseable.

NOTES

- It's mesh_0_55