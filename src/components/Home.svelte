<script lang="ts">
  import { gsap } from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";
  import SimulationComponent from "../components/SimulationComponent.svelte";
  import { onMount } from "svelte";

  gsap.registerPlugin(ScrollTrigger);

  let heroEl: HTMLDivElement;
  let subheroEl: HTMLDivElement;
  let itemsEl: HTMLDivElement;
  let carouselSectionEl: HTMLDivElement;

  // Bindable state passed down to SimulationComponent
  let activeScene = $state<"simulation" | "carousel" | "idle">("simulation");
  let canvasOpacity = $state(1);
  let heroScrollProgress = $state(0);
  let subheroOpacity = $state(1);
  let carouselUIOpacity = $state(0);

  onMount(() => {
    // 1. Hero: fade canvas out and drive camera zoom
    //    The 1.5× multiplier makes the canvas fully transparent by ~67% scroll
    //    through the hero, leaving a visual pause before the next section.
    const heroTrigger = ScrollTrigger.create({
      trigger: heroEl,
      start: "top top",
      end: "bottom top",
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = Math.max(0, Math.min(1, 1.5 * self.progress));
        heroScrollProgress = p;
        // Only drive opacity when this scene owns it
        if (activeScene === "simulation") {
          canvasOpacity = 1 - p;
        }
      },
    });

    // 2. Carousel fade-in: approaching the carousel section from above
    const carouselEnterTrigger = ScrollTrigger.create({
      trigger: carouselSectionEl,
      start: "top bottom",
      end: "top 20%",
      scrub: true,
      invalidateOnRefresh: true,
      onEnter: () => {
        activeScene = "carousel";
      },
      onLeaveBack: () => {
        activeScene = "simulation";
        carouselUIOpacity = 0;
        // Restore hero-driven opacity so there's no jump
        const heroProgress = heroTrigger.progress;
        const p = Math.max(0, Math.min(1, 1.5 * heroProgress));
        canvasOpacity = 1 - p;
      },
      onUpdate: (self) => {
        // Only drive opacity when carousel scene owns it
        if (activeScene === "carousel") {
          canvasOpacity = self.progress;
        }
      },
    });

    // 3. Carousel UI fade-in: once the canvas is fully visible, fade in text + controls
    const carouselUITrigger = ScrollTrigger.create({
      trigger: carouselSectionEl,
      start: "top top",
      end: "15% top",
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        if (activeScene === "carousel") {
          carouselUIOpacity = self.progress;
        }
      },
      onLeaveBack: () => {
        carouselUIOpacity = 0;
      },
    });

    // 4. Carousel fade-out: scrolling past the carousel section downward
    const carouselExitTrigger = ScrollTrigger.create({
      trigger: carouselSectionEl,
      start: "bottom 80%",
      end: "bottom 20%",
      scrub: true,
      invalidateOnRefresh: true,
      onLeave: () => {
        activeScene = "idle";
        canvasOpacity = 0;
        carouselUIOpacity = 0;
      },
      onEnterBack: () => {
        activeScene = "carousel";
        // Sync opacity to current progress so there's no discontinuous jump
        canvasOpacity = 1 - carouselExitTrigger.progress;
        // The UI trigger range (top top → 15% top) is far above, so it won't
        // fire when re-entering from below. Force full UI visibility since the
        // scroll position is well past the UI fade-in zone.
        carouselUIOpacity = 1;
      },
      onUpdate: (self) => {
        if (activeScene === "carousel") {
          canvasOpacity = 1 - self.progress;
        }
      },
    });

    // 5. Subhero: fade out as the items section scrolls up over it
    const subheroFadeTrigger = ScrollTrigger.create({
      trigger: itemsEl,
      start: "top bottom",
      end: "top 60%",
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        subheroOpacity = 1 - self.progress;
      },
    });

    // Refresh trigger positions after images / layout settles
    ScrollTrigger.refresh();

    return () => {
      heroTrigger.kill();
      carouselEnterTrigger.kill();
      carouselUITrigger.kill();
      carouselExitTrigger.kill();
      subheroFadeTrigger.kill();
    };
  });

  const itemData = [
    {
      id: "problem",
      title: "Discovery is Bottlenecked",
      text: [
        "Humanity studies the cosmos through a handful of instruments. The waitlists are years long. Most proposals never get time. The universe is vast, but our access to it is scarce.",
        "The dominant model is to build one massive observatory at a time. It is slow, expensive, and brittle. Each mission takes a decade or more. When everything rides on one launch, cost and schedule explode.",
        "Scarcity shapes the science. When telescope time is rationed and missions cannot fail, the system selects for safe bets. Incremental questions win over bold ones. The proposals most likely to change our understanding, the ones that challenge assumptions and risk being wrong, are the first to get cut. We are optimizing for caution when we should be optimizing for discovery.",
      ],
      image: "/images/0-Space-512w.jpg",
    },
    {
      id: "vision",
      title: "Make Exploration Abundant",
      text: [
        "Cosmic Frontier is driving a technoeconomic phase change in space science hardware. We are rebuilding orbital observatories from first principles to collapse cost, compress timelines, and push performance at the same time. Not incremental improvement. A different regime.",
        "We build iteratively. Each mission informs the next. New detectors, better optics, lessons from flight, and improvements in test and integration flow straight into the next build. The platform evolves continuously instead of freezing technology into decade-long cycles.",
        "The result is fleets of capable observatories instead of lone flagships. Telescope time that is not rationed. Ambitious science that does not wait. Access to the cosmos on the scale of human curiosity.",
      ],
      image: "/images/1-TelescopesOrbiting-512w.jpg",
    },
    {
      id: "impact",
      title: "Unlock Scientific Discovery",
      text: [
        "Abundance changes the shape of science. More observatories is not just more time. It means flying newer instruments, with the latest detectors and techniques, instead of hardware that was locked in years before launch. It means variety. Different wavelengths, specialized sensors, and instruments built for specific questions.",
        "A repeatable platform opens space to research groups that have never had a path to orbit. Universities and labs can fly their own instruments and pursue science that would never survive the flagship proposal process. This is not just more observing time. It is more observers, more questions, and more ways of seeing.",
        "When we broaden access to space, we broaden what gets discovered. The next breakthrough will not come only from a single flagship. It will come from the instrument no one expected, asking the question no one else thought to ask.",
      ],
      image: "/images/2-TheLab-512w.jpg",
    },
  ];
</script>

<div class="simulation-container">
  <SimulationComponent {activeScene} {canvasOpacity} {heroScrollProgress} {carouselUIOpacity} />
</div>

<div class="hero" bind:this={heroEl}>
  <div class="hero__content">
    <div class="hero__content__text">
      <span class="hero__subtitle">Open more windows to the Universe </span>
    </div>
  </div>
</div>

<div class="subhero" bind:this={subheroEl}>
  <p id="subhero__text" style:opacity={subheroOpacity}>
    We're building a new class of scientific tools to accelerate discovery and exploration of the Universe. Standard
    platforms. Modular instruments. Rapid iteration. Built to put more scientific capability in space, more often.
  </p>
</div>

<div class="items" bind:this={itemsEl}>
  {#each itemData as item, index}
    <div class="item" id={item.id} data-index={index} style="--index: {index}">
      <div class="item__inner">
        <h2 id={`${item.id}-heading`}>
          <span class="item__heading__number">{index + 1}.</span>
          {item.title}
        </h2>
        <div class="item__text">
          {#each item.text as paragraph}
            <p>{paragraph}</p>
          {/each}
        </div>
        <img src={item.image} alt={`Illustration for ${item.title} section`} />
      </div>
    </div>
  {/each}
</div>
<!-- <div class="divider"></div> -->

<div class="carousel-section" bind:this={carouselSectionEl}>
  <!-- Carousel 3D content is now rendered by SimulationComponent's shared canvas -->
  <!-- This div serves as the scroll trigger anchor -->
</div>

<div class="join-us">
  <div>
    <h2>Cosmic Frontier Labs</h2>
    <div class="join-us__links">
      <a href="/blog">blog</a>
      <span aria-hidden="true" class="dot-separator"></span>
      <a href="/join-us">join us</a>
      <span aria-hidden="true" class="dot-separator"></span>
      <a href="/contact">contact</a>
    </div>
  </div>
</div>

<style lang="scss">
  .simulation-container {
    position: relative;
    z-index: var(--z-simulation);
  }

  /* HERO */
  .hero {
    min-height: 95lvh;
    position: relative;
    z-index: var(--z-hero);
  }

  .hero__content {
    margin-block-start: var(--space-l);
    display: grid;
    grid-template-rows: auto 1fr;
    grid-template-columns: 1fr;
    justify-content: center;
    align-items: center;
    height: 80lvh;
  }

  .hero__content__text {
    display: flex;
    flex-direction: column;
    pointer-events: none;
    /* Local z-index within .hero's stacking context */
    z-index: 1;
  }

  .hero__subtitle {
    text-shadow:
      2px 2px 8px rgba(0, 0, 0, 0.8),
      0 0 4px rgba(0, 0, 0, 0.9);
    text-transform: uppercase;
    font-size: var(--size-step-4);
    font-weight: 500;
    line-height: 1;
    text-wrap: balance;
    margin-block-start: 0.125em;

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

    position: sticky;
    top: 0lvh;

    & > p {
      max-width: 40ch;
      text-align: center;
      margin-inline: auto;
      text-wrap: balance;
      color: var(--color-text);
      font-size: var(--size-step-3);
    }
  }

  /* ITEMS */
  .items {
    --items-background-color: var(--color-text);
    --items-text-color: var(--body-bg);
    --card-top: 10vh;
    --card-offset: 1rem;

    margin-block-start: 25lvh;

    position: relative;
    z-index: var(--z-items);
    color: var(--items-text-color);
  }

  .item {
    position: sticky;
    top: calc(var(--card-top) + var(--index) * var(--card-offset));
    min-height: calc(90vh - var(--index) * var(--card-offset));
    /* Local to .items stacking context – only needs to order cards among themselves */
    z-index: calc(1 + var(--index));

    background: var(--items-background-color);
    border-radius: 16px;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .item__inner {
    max-width: var(--content-width);
    margin-inline: auto;
    padding: 3rem 1rem 4rem;

    row-gap: 1lh;
    column-gap: 1lh;

    @media (min-width: 56rem) {
      display: grid;
      grid-template-columns: 3fr 2fr;
      grid-template-rows: auto 1fr;
      padding: 4rem 2rem;
    }
  }

  .item h2 {
    grid-column: 1 / 2;
    grid-row: 1 / 2;
    text-transform: uppercase;
    line-height: 1.1;
    font-size: var(--size-step-2);
    font-weight: 700;
  }

  .item__heading__number {
    font-size: var(--size-step-2);
    font-weight: 700;
  }

  .item .item__text {
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

  .item img {
    width: 100%;
    height: auto;
    object-fit: cover;
    margin-block-start: 1lh;

    @media (min-width: 56rem) {
      grid-column: 2 / -1;
      grid-row: 1 / -1;
      margin-block-start: 0;
    }
  }

  // Carousel Section - scroll anchor with min-height
  // pointer-events: none so the empty anchor doesn't block the
  // carousel overlay rendered inside .simulation-container (z-index 10).
  .carousel-section {
    position: sticky;
    top: 0;
    min-height: 250lvh;
    z-index: var(--z-carousel-ui);
    pointer-events: none;
  }

  /* JOIN US */
  .join-us {
    min-height: 90lvh;
    width: 100lvw;
    margin-inline: calc(50% - 50lvw);
    position: relative;
    z-index: var(--z-join-us);

    background-image: url("/images/join-us.jpg");
    background-position: center center;
    background-repeat: no-repeat;
    background-size: cover;
    background-attachment: fixed;

    display: grid;
    place-content: center;
    justify-items: center;
    align-items: center;
    text-align: center;

    & * {
      text-shadow:
        2px 2px 8px rgba(0, 0, 0, 0.8),
        0 0 4px rgba(0, 0, 0, 0.9);
    }

    & h2 {
      font-size: var(--size-step-5);
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
    }

    & a {
      text-decoration: none;
    }

    & a:hover {
      text-decoration: underline;
    }
  }

  .join-us__links {
    margin-block-start: var(--space-s);
    display: flex;
    gap: 1rem;
    justify-content: center;
    align-items: center;
  }

  .dot-separator {
    height: 0.25em;
    aspect-ratio: 1 / 1;
    background: var(--color-text);
    border-radius: 50%;
  }

  .divider {
    position: relative;
    height: 50lvh;
    background: var(--body-bg);
    z-index: var(--z-divider);
  }
</style>
