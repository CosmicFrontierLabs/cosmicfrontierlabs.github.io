<script lang="ts">
  import { gsap } from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";
  import SimulationComponent from "../components/SimulationComponent.svelte";
  import { onMount } from "svelte";

  gsap.registerPlugin(ScrollTrigger);

  let heroEl: HTMLDivElement;
  let carouselSectionEl: HTMLDivElement;

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

<SimulationComponent carouselTriggerEl={carouselSectionEl} />

<div class="hero" bind:this={heroEl}>
  <div class="hero__content">
    <div class="hero__content__text">
      <span class="hero__subtitle">Open more windows to the Universe </span>
    </div>
  </div>
</div>

<div class="subhero">
  <p id="subhero__text">
    We're building a new class of scientific tools to accelerate discovery and exploration of the Universe. Standard
    platforms. Modular instruments. Rapid iteration. Built to put more scientific capability in space, more often.
  </p>
</div>

<div class="items">
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
<div class="divider"></div>

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
  /* HERO */
  .hero {
    min-height: 95lvh;
    position: relative;
    z-index: 2;
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
    z-index: 2;
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
    z-index: 10;

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
    z-index: 11;
    color: var(--items-text-color);
  }

  .item {
    position: sticky;
    top: calc(var(--card-top) + var(--index) * var(--card-offset));
    min-height: calc(90vh - var(--index) * var(--card-offset));
    z-index: calc(10 + var(--index));

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

  // Carousel Section - now just a scroll anchor with min-height
  .carousel-section {
    position: relative;
    min-height: 80lvh;
    z-index: 12;
    border-radius: 96px;
    background: transparent;

    width: 100lvw;
    margin-inline: calc(50% - 50lvw);
  }

  /* JOIN US */
  .join-us {
    min-height: 90lvh;
    width: 100lvw;
    margin-inline: calc(50% - 50lvw);
    position: relative;
    z-index: 12;

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
    z-index: 11;
  }
</style>
