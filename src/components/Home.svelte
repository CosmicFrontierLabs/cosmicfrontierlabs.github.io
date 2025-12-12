<script lang="ts">
  import SimulationComponent from "../components/SimulationComponent.svelte";
  import SlidingNumber from "../components/SlidingNumber.svelte";
  import { onMount } from "svelte";
  import gsap from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";

  let curSection: "problem" | "vision" | "impact" = $state("problem");

  let curSectionNumber = $derived(curSection === "problem" ? "01" : curSection === "vision" ? "02" : "03");
  let offsets = $state<Record<"problem" | "vision" | "impact", number>>({
    problem: 0,
    vision: 0,
    impact: 0,
  });

  const itemData = [
    {
      id: "problem",
      title: "Space Astronomy is at risk",
      text: [
        "By 2050, we may have no operational space telescopes. The tools that power discovery, inspire new scientists, and expand our understanding of the universe are on track to disappear.",
        "Today's model of building single, massive observatories is slow, expensive, and fragile. Each mission takes decades and carries enormous risk. If one telescope fails, an entire generation of science can stall with it.",
      ],
      image: "/images/problem.jpg",
    },
    {
      id: "vision",
      title: "Abundant space telescopes",
      text: [
        "Imagine expanding humanity's cosmic horizons by scaling up the number and capability of orbital observatories, bringing Hubble-quality to fleets of telescopes rather than single flagships. By redesigning precision instruments for manufacturability and iteration, the team is moving space astronomy from an era of scarcity to one of abundance, continuous innovation, and exponential discovery.",
        "These telescopes will form a platform for science that evolves as quickly as the questions we ask. We will build the platform iteratively, to continuously integrate new detectors, optics, and algorithms on successive units.",
        "In this near future, exploring the cosmos won't depend on waiting decades for the next great observatory, but on a living, growing constellation of instruments; each a window into the expanding frontier of human understanding.",
      ],
      image: "/images/vision.jpg",
    },
    {
      id: "impact",
      title: "Unlock Scientific Discovery",
      text: [
        "A larger constellation increases observing time, expands coverage across the sky, and captures events that single observatories routinely miss. With many instruments working together, scientists can study the Universe with higher cadence, greater detail, and unprecedented breadth.",
        "This scale enables research impossible with one or two flagship missions. We can monitor dynamic phenomena continuously, survey vast regions of space in parallel, and follow up discoveries in real time. Every additional telescope multiplies the scientific return.",
        "When we increase the capacity of space astronomy, we accelerate discovery itself, opening the door to insights we can't yet imagine.",
      ],
      image: "/images/impact.jpg",
    },
  ];

  function scrollTo(id: "problem" | "vision" | "impact") {
    window.scrollTo({ top: offsets[id], behavior: "smooth" });
    curSection = id;
  }

  function handleTOCKeydown(e: KeyboardEvent, currentId: "problem" | "vision" | "impact") {
    const sections: Array<"problem" | "vision" | "impact"> = ["problem", "vision", "impact"];
    const currentIndex = sections.indexOf(currentId);

    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % sections.length;
      scrollTo(sections[nextIndex]);
      // Focus the next button
      const nextButton = document.querySelector(`[aria-controls="${sections[nextIndex]}"]`) as HTMLButtonElement;
      nextButton?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + sections.length) % sections.length;
      scrollTo(sections[prevIndex]);
      // Focus the previous button
      const prevButton = document.querySelector(`[aria-controls="${sections[prevIndex]}"]`) as HTMLButtonElement;
      prevButton?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      scrollTo("problem");
      const firstButton = document.querySelector('[aria-controls="problem"]') as HTMLButtonElement;
      firstButton?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      scrollTo("impact");
      const lastButton = document.querySelector('[aria-controls="impact"]') as HTMLButtonElement;
      lastButton?.focus();
    }
  }

  function slideInImage(image: HTMLElement): ScrollTrigger | null {
    gsap.set(image, { x: "200%" });

    const tween = gsap.to(image, {
      x: 0,
      ease: "none",
      scrollTrigger: {
        trigger: image,
        start: "top 100%",
        end: "top 100%",
        scrub: 1,
        pin: true,
      },
    });

    return tween.scrollTrigger || null;
  }

  function revealImageHeight(image: HTMLElement): ScrollTrigger | null {
    const tween = gsap.from(image, {
      clipPath: "inset(100% 0 0 0)",
      ease: "none",
      scrollTrigger: {
        trigger: image,
        start: "top 100%",
        end: "top 60%",
        scrub: 1,
      },
    });

    return tween.scrollTrigger || null;
  }

  function getAbsoluteTop(element: HTMLElement): number {
    // Temporarily remove sticky positioning to get the natural position
    const originalPosition = element.style.position;
    const originalTop = element.style.top;

    element.style.position = "static";
    element.style.top = "";

    // Force a reflow to ensure the position change takes effect
    void element.offsetHeight;

    // Calculate the absolute position
    let offsetTop = 0;
    let currentElement: HTMLElement | null = element;

    while (currentElement) {
      offsetTop += currentElement.offsetTop;
      currentElement = currentElement.offsetParent as HTMLElement | null;
    }

    // Restore the original positioning
    element.style.position = originalPosition;
    element.style.top = originalTop;

    return offsetTop;
  }

  onMount(() => {
    gsap.registerPlugin(ScrollTrigger);

    // Store ScrollTrigger instances for cleanup
    const triggers: ScrollTrigger[] = [];

    // Hero text animation
    const heroText = document.querySelector(".hero__content__text") as HTMLElement;
    if (heroText) {
      const heroTween = gsap.to(heroText, {
        yPercent: -40,
        scrollTrigger: {
          trigger: heroText,
          scrub: true,
          start: "top 15%",
          end: "+=20%",
        },
      });
      if (heroTween.scrollTrigger) {
        triggers.push(heroTween.scrollTrigger);
      }
    }

    // Subhero text animation
    const subheroText = document.getElementById("subhero__text");
    if (subheroText) {
      const subheroTween = gsap.to(subheroText, {
        yPercent: -30,
        scrollTrigger: {
          trigger: subheroText,
          scrub: true,
          start: "top 90%",
          end: "top 0%",
        },
      });
      if (subheroTween.scrollTrigger) {
        triggers.push(subheroTween.scrollTrigger);
      }
    }

    // Calculate item offsets
    const items = gsap.utils.toArray(".item") as HTMLElement[];
    items.forEach((item) => {
      const itemId = item.id as keyof typeof offsets;
      offsets[itemId] = getAbsoluteTop(item);
    });

    // Create ScrollTrigger for each .item element
    items.forEach((item) => {
      const itemId = item.id as "problem" | "vision" | "impact";

      // Validate the ID
      if (itemId !== "problem" && itemId !== "vision" && itemId !== "impact") {
        return;
      }

      const trigger = ScrollTrigger.create({
        trigger: item,
        start: "top 80%", // Equivalent to -20% rootMargin from top
        end: "top -60%", // Because most of it's in view at that point
        onEnter: () => {
          curSection = itemId;
        },
        onEnterBack: () => {
          curSection = itemId;
        },
      });

      triggers.push(trigger);
    });

    // Add image animations to the items
    const images = gsap.utils.toArray(".item img") as HTMLElement[];
    images.forEach((image, index) => {
      const trigger = index % 2 === 1 ? slideInImage(image) : revealImageHeight(image);
      if (trigger) {
        triggers.push(trigger);
      }
    });

    return () => {
      // Clean up all ScrollTrigger instances
      triggers.forEach((trigger) => trigger?.kill());
    };
  });
</script>

<div class="hero">
  <div class="hero__content">
    <div class="hero__content__text">
      <span class="hero__subtitle">Building the future of space astronomy</span>
    </div>
    <div class="hero__content__simulation">
      <SimulationComponent />
    </div>
  </div>
</div>

<div class="subhero">
  <p id="subhero__text">
    We're building a new class of scientific tools to accelerate discovery and exploration of the Universe.
  </p>
</div>

<div class="items">
  <div class="items__inner">
    <div class="items__toc">
      <div class="items__toc__number">
        <SlidingNumber currentNumber={curSectionNumber} />
      </div>
      <div class="items__toc__nav" role="tablist" aria-label="Section navigation">
        <button
          onclick={() => scrollTo("problem")}
          onkeydown={(e) => handleTOCKeydown(e, "problem")}
          data-selected={curSection === "problem"}
          aria-label="Navigate to Problem section"
          aria-controls="problem"
          role="tab"
          aria-selected={curSection === "problem"}
        >
          PROBLEM
        </button>
        <button
          onclick={() => scrollTo("vision")}
          onkeydown={(e) => handleTOCKeydown(e, "vision")}
          data-selected={curSection === "vision"}
          aria-label="Navigate to Vision section"
          aria-controls="vision"
          role="tab"
          aria-selected={curSection === "vision"}
        >
          VISION
        </button>
        <button
          onclick={() => scrollTo("impact")}
          onkeydown={(e) => handleTOCKeydown(e, "impact")}
          data-selected={curSection === "impact"}
          aria-label="Navigate to Impact section"
          aria-controls="impact"
          role="tab"
          aria-selected={curSection === "impact"}
        >
          IMPACT
        </button>
      </div>
    </div>
    {#each itemData as item, index}
      <div class="item" id={item.id} data-index={index} role="tabpanel" aria-labelledby={`${item.id}-heading`}>
        <h2 id={`${item.id}-heading`}>
          <span class="item__heading__number">0{index + 1}.</span>
          {item.title}</h2>
        <div class="item__text">
          {#each item.text as paragraph}
            <p>{paragraph}</p>
          {/each}
        </div>
        <img src={item.image} alt={`Illustration for ${item.title} section`} />
      </div>
    {/each}
  </div>
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
  }

  .hero__content {
    margin-block-start: 4lvh;
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

    @media (min-width: 48rem) {
      font-size: var(--size-step-5);
    }
  }

  .hero__content__simulation {
    // --sim-size: 100vmin;
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100lvw;
    height: 100lvh;
    transform: translate3d(-50%, -50%, 0); /* Use translate3d for better GPU acceleration */
    background: var(--body-bg);
    z-index: 1;


    // TODO: This isn't working robustly and not sure why
    // &, &:hover, &:active {
    //   cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='8' height='8' fill='white'/></svg>") 4 4, auto;
    // }
  }

  /* SUBHERO */
  .subhero {
    min-height: 95lvh;
    display: grid;
    place-content: center;
    z-index: 10;
    position: relative;

    background: linear-gradient(in oklch to bottom, var(--body-bg), var(--color-text));
    width: 100lvw;
    margin-inline: calc(50% - 50vw);
    // border-bottom: 1px solid var(--body-bg);

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

    width: 100lvw;
    margin-inline: calc(50% - 50vw);

    background: var(--items-background-color);
    color: var(--items-text-color);
    position: relative;
    z-index: 1;
    padding-block-end: 20lvh;
  }

  .items__inner {
    max-width: var(--content-width);
    margin-inline: auto;

    display: grid;
    grid-template-columns: 1fr 3fr;
    grid-template-rows: 1fr;
  }

  .items__toc {
    margin-block-start: 4.25rem;
    position: sticky;
    top: 4.25rem;
    left: 0;

    gap: 1rem;
    display: none;

    @media (min-width: 48rem) {
      display: flex;
    }
  }

  .items__toc__number {
    margin-block-start: 0.125rem;
  }

  .items__toc__nav {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    margin-block-start: 0.375em;

    & > * {
      font-weight: 300;
      font-size: 14px;
      opacity: 0.7;
      transition: opacity 0.2s ease;
      text-decoration: none;
      background: none;
      text-align: left;
      border: none;
      cursor: pointer;

      // Handle if it's a button by unstyling the button
    }
    & > *[data-selected="true"] {
      opacity: 1;
      font-weight: 700;
    }

    & > *:hover {
      opacity: 1;
      font-weight: 700;
    }
  }

  .item {
    background: var(--items-background-color);
    padding-block-start: 4rem;
    margin-block-end: 4rem;
    overflow-x: hidden;

    grid-column: 1 / -1;
    row-gap: 1lh;
    column-gap: 1lh;

    @media (min-width: 48rem) {
      min-height: 95lvh;
      position: sticky;
      top: -2px; /* -2px to offset the border */
      display: grid;
      grid-column: 2 / -1;
      grid-template-columns: 3fr 2fr;
      grid-template-rows: auto 1fr;

      // Border
      &[data-index="1"],
      &[data-index="2"] {
        border-top: 2px solid var(--body-bg);
      }
    }
  }

  .item h2 {
    grid-column: 1 / 2;
    grid-row: 1 / 2;
    text-transform: uppercase;
    line-height: 1.1;
    font-size: var(--size-step-4);
    font-weight: 500;
  }

  .item__heading__number {
    font-weight: 700;
    opacity: 0.7;
    display: inline;

    @media (min-width: 48rem) {
      display: none;
    }
  }

  .item .item__text {
    grid-column: 1 / 2;
    grid-row: 2 / -1;

    font-size: var(--size-step--1);
    max-width: 55ch;
    font-family: var(--font-sans);

    @media (min-width: 48rem) {

    & > p:first-of-type {
      margin-block-start: 0;
    }
    }
  }

  .item img {
    width: 100%;
    height: auto;
    object-fit: cover;

    grid-column: 2 / -1;
    grid-row: 2 / -1;
    margin-block-start: 1lh;

    @media (min-width: 48rem) {
      margin-block-start: 0;
      padding: 0;
    }
  }

  /* JOIN US */
  .join-us {
    min-height: 90lvh;
    width: 100lvw;
    margin-inline: calc(50% - 50lvw);

    background-image: url("/images/join-us.jpg");
    background-position: center center;
    background-repeat: no-repeat;
    background-size: cover;

    // Note that ios doesn't support background-attachment: fixed
    // for performance reasons
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
</style>
