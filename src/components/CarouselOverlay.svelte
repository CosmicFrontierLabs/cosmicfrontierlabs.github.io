<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";
  import gsap from "gsap";
  import type { CarouselScene } from "./simulation/CarouselScene";
  import { carouselData } from "./simulation/CarouselScene";

  interface Props {
    carouselScene: CarouselScene | null;
  }

  let { carouselScene }: Props = $props();

  const SLIDE_DURATION_MS = 5000;

  let activeSlideIndex = $state(0);
  let progress = $state(0);
  let titleEl: HTMLHeadingElement;
  let descriptionEl: HTMLParagraphElement;

  // GSAP-based autoplay timeline
  let autoplayTween: gsap.core.Tween | null = null;

  function startAutoplay() {
    stopAutoplay();
    progress = 0;

    const proxy = { value: 0 };
    autoplayTween = gsap.to(proxy, {
      value: 100,
      duration: SLIDE_DURATION_MS / 1000,
      ease: "none",
      onUpdate() {
        progress = proxy.value;
      },
      onComplete() {
        goToNext();
      },
    });
  }

  function stopAutoplay() {
    if (autoplayTween) {
      autoplayTween.kill();
      autoplayTween = null;
    }
    progress = 0;
  }

  function goToIndex(index: number) {
    if (!carouselScene) return;
    if (index === activeSlideIndex) return;

    // Restart autoplay timer immediately (resets progress bar)
    activeSlideIndex = index;
    startAutoplay();

    const tl = gsap.timeline();
    const nextItem = carouselData[index];

    // Fade out current text
    tl.to(titleEl, { opacity: 0, duration: 0.3 }, 0);
    tl.to(descriptionEl, { opacity: 0, duration: 0.3 }, 0);

    // Update model
    carouselScene.setActiveModel(index);

    // Fade in new text
    tl.fromTo(titleEl, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);
    tl.fromTo(descriptionEl, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);

    // Camera animation
    const targetPos = new THREE.Vector3(
      nextItem.camera.position.x,
      nextItem.camera.position.y,
      nextItem.camera.position.z
    );
    const targetLookAt = new THREE.Vector3(
      nextItem.camera.lookAt.x,
      nextItem.camera.lookAt.y,
      nextItem.camera.lookAt.z
    );
    tl.add(carouselScene.animateCameraTo(targetPos, targetLookAt, 2.5), 0);
  }

  function goToNext() {
    const nextIndex = (activeSlideIndex + 1) % carouselData.length;
    goToIndex(nextIndex);
  }

  function goToPrev() {
    const prevIndex = (activeSlideIndex - 1 + carouselData.length) % carouselData.length;
    goToIndex(prevIndex);
  }

  onMount(() => {
    console.log("CarouselOverlay mounted");
    startAutoplay();

    return () => {
      stopAutoplay();
    };
  });
</script>

<div
  class="carousel-overlay"
  role="application"
  aria-label="3D model carousel"
>
  <h2>Explore our telescope</h2>
  <div class="carousel-glass bg-glass2">
    <div class="description-wrapper">
      <h3 bind:this={titleEl}>{activeSlideIndex + 1}. {carouselData[activeSlideIndex].title}</h3>
      <p bind:this={descriptionEl}>{carouselData[activeSlideIndex].description}</p>
    </div>

    <div class="carousel-controls">
      <button class="nav-arrow" onclick={() => goToPrev()} aria-label="Previous slide">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <div class="indicators">
        {#each carouselData as _, i}
          <button
            class="indicator"
            class:active={i === activeSlideIndex}
            onclick={() => goToIndex(i)}
            aria-label="Go to slide {i + 1}"
          >
            {#if i === activeSlideIndex}
              <div class="progress-fill" style="width: {progress}%"></div>
            {/if}
          </button>
        {/each}
      </div>
      <button class="nav-arrow" onclick={() => goToNext()} aria-label="Next slide">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  </div>
</div>

<style>
  .carousel-overlay {
    position: fixed;
    top: 14lvh;
    left: 0;
    right: 0;
    bottom: 0;
    max-width: var(--content-width);
    margin-inline: auto;
    z-index: 14;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: start;
    padding-block-end: 2%;
    padding-inline: 1rem;

    @media (min-width: 56rem) {
      top: 12lvh;
      padding-inline: 2rem;
    }
  }

  .carousel-overlay h2 {
    text-shadow:
      2px 2px 8px rgba(0, 0, 0, 0.8),
      0 0 4px rgba(0, 0, 0, 0.9);
    text-transform: uppercase;
    font-size: var(--size-step-3);
    font-weight: 500;
    line-height: 1;
    text-wrap: balance;
    margin-block-start: 0.125em;

    @media (min-width: 56rem) {
      font-size: var(--size-step-5);
    }
  }

  .carousel-glass {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding-block: 0.75rem;
    width: 100%;
    box-sizing: border-box;
    container-type: inline-size;
    width: 100%;

    @media (min-width: 40rem) {
      width: 400px;
    }

    @media (min-width: 56rem) {
      width: 500px;
      padding-block: 1rem;
    }
  }

  .description-wrapper {
    padding: 1ch 1.5ch;
    font-size: 0.8125rem;
    max-width: 60ch;
    min-height: 6lh;

    @media (min-width: 56rem) {
      padding: 2ch 2ch;
      font-size: 0.875rem;
      min-height: 8lh;
    }
  }

  .description-wrapper h3 {
    font-size: 1.125rem;
    text-wrap: balance;
    margin-block-start: 0lh;
    margin-block-end: 0.25lh;

    @media (min-width: 56rem) {
      font-size: 1.325rem;
    }
  }

  .carousel-controls {
    margin-block: 0.5rem;
    padding-inline: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-inline-end: auto;
    gap: 8px;

    @media (min-width: 56rem) {
      margin-block: 1rem;
      padding-inline: 1rem;
      gap: 12px;
    }
  }

  .nav-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    cursor: pointer;
    color: currentColor;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.4);
    }
  }

  .indicators {
    display: none;
    gap: 8px;

    @container (min-width: 350px) {
      display: flex;
    }
  }

  .indicator {
    position: relative;
    width: 24px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border: none;
    border-radius: 2px;
    cursor: pointer;
    overflow: hidden;
    transition: background 0.2s ease;
    padding: 0;

    &:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    &.active {
      background: rgba(255, 255, 255, 0.3);
    }
  }

  .progress-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 2px;
    transition: width 0.05s linear;
  }
</style>
