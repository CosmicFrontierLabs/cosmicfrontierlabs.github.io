- Make a PR without the carousel copy
- Make a PR with the carousel copy (for aaron to fill in)

- We currently have no fallback on slow networks - do we want to change that?
  - We do timeout though:
    - loading the earth has a timeout. and if that timeouts, then
    - isEarthReady is never set to true in homepage, which never triggers the carouselcanvas to load.
