<script lang="ts">
  import { gsap } from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";
  import EarthCanvas from "../components/EarthCanvas.svelte";
  import CarouselCanvas from "../components/CarouselCanvas.svelte";
  import { onMount } from "svelte";
  import { scrollY, innerHeight } from "svelte/reactivity/window";
  import type { CarouselItem } from "$lib/types";

  gsap.registerPlugin(ScrollTrigger);

  interface Props {
    carouselData: CarouselItem[];
  }

  let { carouselData }: Props = $props();

  let heroEl: HTMLDivElement;
  let sectionsEl: HTMLDivElement;

  // Split opacity: each canvas fades independently
  let earthTriggeredOpacity = $state<number | null>(null);

  // Before mount, derive earth opacity from raw scroll position so the canvas
  // is hidden if the browser restores a non-zero scroll position.
  // After mount, ScrollTrigger takes over.
  let earthOpacity = $derived.by(() => {
    if (earthTriggeredOpacity !== null) {
      return earthTriggeredOpacity;
    }

    if (
      scrollY.current !== null &&
      scrollY.current !== undefined &&
      innerHeight.current !== null &&
      innerHeight.current !== undefined
    ) {
      return scrollY.current / innerHeight.current;
    }
    return 0;
  });

  // EarthCanvas signals when it's ready so CarouselCanvas can start loading
  let earthReady = $state(false);

  let heroScrollProgress = $state(0);
  let subheroOpacity = $state(1);
  let subheroPointerEvents = $derived(subheroOpacity > 0 ? "auto" : "none");

  onMount(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 1. Hero: fade canvas out and drive camera zoom
    //    The 1.5× multiplier makes the canvas fully transparent by ~67% scroll
    //    through the hero, leaving a visual pause before the next section.
    const heroTrigger = ScrollTrigger.create({
      trigger: heroEl,
      start: "top 10%",
      end: "bottom 50%",
      scrub: 0.5,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        // Skip camera zoom on mobile — the resize/scroll interactions cause jarring size changes
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        heroScrollProgress = isMobile || prefersReducedMotion ? 0 : self.progress;
        earthTriggeredOpacity = 1 - self.progress;
      },
    });

    // 2. Subhero: fade out as the content sections scroll up over it
    const subheroFadeTrigger = ScrollTrigger.create({
      trigger: sectionsEl,
      start: "top bottom",
      end: "top 60%",
      scrub: 0.5,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        subheroOpacity = 1 - self.progress;
      },
    });

    // Refresh trigger positions after images / layout settles,
    // then force each trigger to evaluate so initial state is correct
    // (e.g., when the browser restores a non-zero scroll position).
    ScrollTrigger.refresh();
    heroTrigger.update();
    subheroFadeTrigger.update();

    // If we're above the hero trigger (top of page), onUpdate never fired,
    // so earthTriggeredOpacity is still null. Set it to 1 (fully visible).
    // If the trigger did fire during refresh, it already set the correct value.
    if (heroTrigger.progress === 0) {
      earthTriggeredOpacity = 1;
    }

    return () => {
      heroTrigger.kill();
      subheroFadeTrigger.kill();
    };
  });

  const contentSections = [
    {
      id: "problem",
      title: "Discovery is Bottlenecked",
      text: [
        "Humanity studies the cosmos through a handful of instruments. The waitlists are years long. Most proposals never get time. The universe is vast, but our access to it is scarce.",
        "The dominant model is to build one massive observatory at a time. It is slow, expensive, and brittle. Each mission takes a decade or more. When everything rides on one launch, cost and schedule explode.",
        "Scarcity shapes the science. When telescope time is rationed and missions cannot fail, the system selects for safe bets. Incremental questions win over bold ones. The proposals most likely to change our understanding, the ones that challenge assumptions and risk being wrong, are the first to get cut. We are optimizing for caution when we should be optimizing for discovery.",
      ],
      image: "/images/0-Space-512w.webp",
      imageAlt: "A vast expanse of deep space with distant stars and nebulae",
    },
    {
      id: "vision",
      title: "Make Exploration Abundant",
      text: [
        "Cosmic Frontier is driving a technoeconomic phase change in space science hardware. We are rebuilding orbital observatories from first principles to collapse cost, compress timelines, and push performance at the same time. Not incremental improvement. A different regime.",
        "We build iteratively. Each mission informs the next. New detectors, better optics, lessons from flight, and improvements in test and integration flow straight into the next build. The platform evolves continuously instead of freezing technology into decade-long cycles.",
        "The result is fleets of capable observatories instead of lone flagships. Telescope time that is not rationed. Ambitious science that does not wait. Access to the cosmos on the scale of human curiosity.",
      ],
      image: "/images/1-TelescopesOrbiting-512w.webp",
      imageAlt: "Multiple telescopes in orbit around Earth, forming a coordinated observation fleet",
    },
    {
      id: "impact",
      title: "Unlock Scientific Discovery",
      text: [
        "Abundance changes the shape of science. More observatories is not just more time. It means flying newer instruments, with the latest detectors and techniques, instead of hardware that was locked in years before launch. It means variety. Different wavelengths, specialized sensors, and instruments built for specific questions.",
        "A repeatable platform opens space to research groups that have never had a path to orbit. Universities and labs can fly their own instruments and pursue science that would never survive the flagship proposal process. This is not just more observing time. It is more observers, more questions, and more ways of seeing.",
        "When we broaden access to space, we broaden what gets discovered. The next breakthrough will not come only from a single flagship. It will come from the instrument no one expected, asking the question no one else thought to ask.",
      ],
      image: "/images/2-TheLab-512w.webp",
      imageAlt: "Engineers working in a laboratory assembling telescope components",
    },
  ];
</script>

<svelte:head>
  <title>Cosmic Frontier Labs</title>
</svelte:head>

<div class="simulation-container">
  <EarthCanvas canvasOpacity={earthOpacity} {heroScrollProgress} onReady={() => (earthReady = true)} />
</div>

<div class="hero" bind:this={heroEl}>
  <div class="hero__content">
    <div class="hero__content__text">
      <h1 class="hero__subtitle">Open more windows to the Universe</h1>
    </div>
  </div>
</div>

<div class="subhero" style="pointer-events: {subheroPointerEvents}; opacity: {subheroOpacity};">
  <p id="subhero__text">
    We're building a new class of scientific tools to accelerate discovery and exploration of the Universe. Standard
    platforms. Modular instruments. Rapid iteration. Built to put more scientific capability in space, more often.
  </p>
</div>

<div class="content-sections" bind:this={sectionsEl}>
  {#each contentSections as section, index}
    <div class="content-section" id={section.id} data-index={index} style="--index: {index}">
      <div class="content-section__inner">
        <h2 id={`${section.id}-heading`}>
          <span class="content-section__heading__number">{index + 1}.</span>
          {section.title}
        </h2>
        <div class="content-section__text">
          {#each section.text as paragraph}
            <p>{paragraph}</p>
          {/each}
        </div>
        <img src={section.image} alt={section.imageAlt} loading="lazy" decoding="async" width="512" height="512" />
      </div>
    </div>
  {/each}
</div>

<div class="carousel-anchor">
  <CarouselCanvas shouldStartLoading={earthReady} {carouselData} />
</div>

<style lang="scss">
  .simulation-container {
    position: relative;
    z-index: var(--z-simulation);
    isolation: isolate;
  }

  /* HERO */
  .hero {
    min-height: 95lvh;
    position: relative;
    z-index: var(--z-hero);
    pointer-events: none;
  }

  .hero__content {
    margin-block-start: var(--space-l);
    display: grid;
    grid-template-rows: auto 1fr;
    grid-template-columns: 1fr;
    justify-content: center;
    align-items: center;
    height: 80lvh;
    padding-inline: 0.25rem;

    @media (min-width: 56rem) {
      padding-inline: 0;
    }
  }

  .hero__content__text {
    display: flex;
    flex-direction: column;
    pointer-events: none;
    z-index: 1;
  }

  .hero__subtitle {
    text-shadow:
      2px 2px 8px rgba(0, 0, 0, 0.8),
      0 0 4px rgba(0, 0, 0, 0.9);
    text-transform: uppercase;
    font-size: var(--size-step-3);
    font-weight: 600;
    line-height: 1;
    text-wrap: balance;
    margin: 0;
    margin-block-start: 0.125em;
    max-width: none;
    padding-inline: 0.5rem;

    @media (min-width: 40rem) {
      font-size: var(--size-step-4);
      padding-inline: 0;
    }

    @media (min-width: 56rem) {
      font-size: var(--size-step-5);
    }
  }

  /* SUBHERO */
  .subhero {
    min-height: 80lvh;
    display: grid;
    place-content: center;
    z-index: var(--z-subhero);
    will-change: opacity;

    position: sticky;
    top: 0;
    padding-inline: 1rem;

    & > p {
      max-width: 40ch;
      text-align: center;
      margin-inline: auto;
      text-wrap: balance;
      color: var(--color-text);
      font-size: var(--size-step-1);

      @media (min-width: 40rem) {
        font-size: var(--size-step-2);
      }

      @media (min-width: 56rem) {
        font-size: var(--size-step-3);
      }
    }
  }

  /* CONTENT SECTIONS (stacking cards) */
  .content-sections {
    --section-background-color: var(--color-text);
    --section-text-color: var(--body-bg);
    --card-offset: 1.25rem;

    margin-block-start: 15lvh;

    position: relative;
    z-index: var(--z-items);
    color: var(--section-text-color);

    @media (min-width: 56rem) {
      margin-block-start: 25lvh;
    }
  }

  .content-section {
    position: relative;
    z-index: calc(1 + var(--index));

    background: var(--section-background-color);
    border-radius: var(--radius-l);
    box-shadow: var(--shadow-card);
    overflow: hidden;

    & + & {
      margin-block-start: var(--space-m);
    }

    @media (min-width: 56rem) {
      position: sticky;
      top: calc(var(--index) * var(--card-offset) + var(--header-height));
      min-height: calc(90lvh - var(--index) * var(--card-offset) - var(--header-height));
      border-radius: var(--radius-l);
      box-shadow: var(--shadow-card-elevated);
    }
  }

  .content-section__inner {
    max-width: var(--content-width);
    margin-inline: auto;
    padding: 2rem 0.375rem 2.5rem;

    row-gap: 1lh;
    column-gap: 1lh;

    @media (min-width: 56rem) {
      display: grid;
      grid-template-columns: 3fr 2fr;
      grid-template-rows: auto 1fr;
      padding: 4rem 2rem;
    }
  }

  .content-section h2 {
    grid-column: 1 / 2;
    grid-row: 1 / 2;
    text-transform: uppercase;
    line-height: 1.1;
    font-size: var(--size-step-1);
    font-weight: 700;

    @media (min-width: 56rem) {
      font-size: var(--size-step-2);
    }
  }

  .content-section__heading__number {
    font-size: var(--size-step-1);
    font-weight: 700;

    @media (min-width: 56rem) {
      font-size: var(--size-step-2);
    }
  }

  .content-section .content-section__text {
    grid-column: 1 / 2;
    grid-row: 2 / -1;

    font-size: var(--size-step--1);
    max-width: 55ch;
    font-family: var(--font-sans);

    @media (min-width: 56rem) {
      & > p:first-of-type {
        margin-block-start: 0;
      }
    }
  }

  .content-section img {
    width: 100%;
    max-width: 350px;
    height: auto;
    object-fit: cover;
    margin-block-start: 1lh;

    @media (min-width: 56rem) {
      max-width: none;
      grid-column: 2 / -1;
      grid-row: 1 / -1;
      margin-block-start: 0;
    }
  }

  // Carousel anchor — scroll-trigger target with min-height.
  // pointer-events: none so the empty anchor doesn't block the
  // carousel overlay rendered inside .simulation-container (z-index 10).
  .carousel-anchor {
    margin-block-start: clamp(var(--space-xl), 20lvh, 15rem) !important;
    margin-block-end: var(--space-m);

    position: relative;
    isolation: isolate;

    min-height: 78lvh;
    overflow: hidden;
    z-index: var(--z-carousel-ui);
    pointer-events: none;
    width: 100%;

    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.25);
    border: var(--stroke);
    border-radius: var(--radius-m);
    background: var(--body-bg);

    @media (min-width: 56rem) {
      min-height: 85lvh;
      margin-inline: auto;
    }
  }
</style>
