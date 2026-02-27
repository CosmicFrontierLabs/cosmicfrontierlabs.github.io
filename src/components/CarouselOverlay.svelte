<script lang="ts">
  import { onMount, untrack } from "svelte";
  import * as THREE from "three";
  import gsap from "gsap";
  import type { CarouselScene } from "./simulation/CarouselScene";
  import { carouselData } from "./simulation/CarouselScene";

  // Pre-allocated vectors reused every slide transition to avoid GC pressure
  const _tmpPos = new THREE.Vector3();
  const _tmpLookAt = new THREE.Vector3();

  interface Props {
    carouselScene: CarouselScene | null;
    paused?: boolean;
    activeScene?: "simulation" | "carousel" | "error" | "loader";
    onExitOrbit?: () => void;
  }

  let { carouselScene, paused = false, activeScene = "simulation", onExitOrbit }: Props = $props();

  const SLIDE_DURATION_MS = 5000;

  let activeSlideIndex = $state(0);
  let progress = $state(0);
  let initialized = $state(false);
  let titleEl: HTMLHeadingElement | null = $state(null);
  let descriptionEl: HTMLParagraphElement | null = $state(null);
  let panelEl: HTMLDivElement;
  let panelInnerEl: HTMLDivElement;
  let autoplayPaused = $state(false);

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
      paused: paused || autoplayPaused,
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

  function toggleAutoplay() {
    autoplayPaused = !autoplayPaused;
    if (autoplayTween) {
      if (autoplayPaused) {
        autoplayTween.pause();
      } else {
        autoplayTween.resume();
      }
    }
  }

  function goToIndex(index: number) {
    if (!carouselScene) return;
    if (initialized && index === activeSlideIndex) return;
    initialized = true;

    // Restart autoplay timer immediately (resets progress bar)
    activeSlideIndex = index;
    startAutoplay();

    const tl = gsap.timeline();
    const nextItem = carouselData[index];

    // Fade out current text (elements may not exist during orbit mode)
    if (titleEl) tl.to(titleEl, { opacity: 0, duration: 0.3 }, 0);
    if (descriptionEl) tl.to(descriptionEl, { opacity: 0, duration: 0.3 }, 0);

    // Update model
    carouselScene.setActiveModel(index);

    // Fade in new text (elements may not exist during orbit mode)
    if (titleEl) tl.fromTo(titleEl, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);
    if (descriptionEl) tl.fromTo(descriptionEl, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);

    // Camera animation
    _tmpPos.set(nextItem.camera.position.x, nextItem.camera.position.y, nextItem.camera.position.z);
    _tmpLookAt.set(nextItem.camera.lookAt.x, nextItem.camera.lookAt.y, nextItem.camera.lookAt.z);
    tl.add(carouselScene.animateCameraTo(_tmpPos, _tmpLookAt, 2.5), 0);
  }

  function goToNext() {
    const nextIndex = (activeSlideIndex + 1) % carouselData.length;
    goToIndex(nextIndex);
  }

  function goToPrev() {
    const prevIndex = (activeSlideIndex - 1 + carouselData.length) % carouselData.length;
    goToIndex(prevIndex);
  }

  // Reset to slide 0 when the carousel becomes the active scene.
  $effect(() => {
    if (activeScene === "carousel" && carouselScene) {
      untrack(() => {
        initialized = false;
        goToIndex(0);
      });
    }
  });

  // Pause/resume autoplay when explore mode toggles
  $effect(() => {
    const shouldPause = paused || autoplayPaused;
    if (autoplayTween) {
      if (shouldPause) {
        autoplayTween.pause();
      } else {
        autoplayTween.resume();
      }
    }
  });

  // Animate panel height when content changes (explore toggle or slide change)
  $effect(() => {
    void paused;
    void activeSlideIndex;

    requestAnimationFrame(() => {
      if (!panelEl || !panelInnerEl) return;
      const targetHeight = panelInnerEl.offsetHeight;
      gsap.to(panelEl, {
        height: targetHeight,
        duration: 0.5,
        ease: "power2.inOut",
      });
    });
  });

  onMount(() => {
    if (panelEl && panelInnerEl) {
      panelEl.style.height = panelInnerEl.offsetHeight + "px";
    }

    startAutoplay();

    return () => {
      stopAutoplay();
    };
  });
</script>

<h2 class="carousel__heading">Explore our telescope</h2>
<div class="carousel__panel bg-glass2" bind:this={panelEl} role="region" aria-label="Telescope carousel">
  <div class="carousel__panel-inner" bind:this={panelInnerEl}>
    {#if paused}
      <div class="carousel__explore-controls">
        <p class="carousel__explore-title">Explore our Telescope</p>

        <div class="carousel__explore-hints">
          <span class="carousel__explore-hint">
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 2L12 22M2 12L22 12M5 5L19 19M19 5L5 19" opacity="0.3" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
            Drag to rotate
          </span>
          <span class="carousel__explore-hint">
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M12 6v3" />
              <path d="M8 18l4 4 4-4" />
            </svg>
            Scroll to zoom
          </span>
          <span class="carousel__explore-hint">
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M5 9l-3 3 3 3" />
              <path d="M9 5l3-3 3 3" />
              <path d="M15 19l-3 3-3-3" />
              <path d="M19 9l3 3-3 3" />
              <path d="M2 12h20" />
              <path d="M12 2v20" />
            </svg>
            Shift+drag to pan
          </span>
        </div>

        <div class="carousel__explore-nav">
          <button class="carousel__exit-btn" onclick={() => onExitOrbit?.()}>
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H16" />
            </svg>
            Back to tour
          </button>
        </div>
      </div>
    {:else}
      <div class="carousel__body" aria-live="polite">
        <h3 class="carousel__title" bind:this={titleEl}>
          {activeSlideIndex + 1}. {carouselData[activeSlideIndex].title}
        </h3>
        <p bind:this={descriptionEl}>{carouselData[activeSlideIndex].description}</p>
      </div>

      <div class="carousel__controls">
        <button class="carousel__nav-btn" onclick={() => goToPrev()} aria-label="Previous slide">
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="carousel__indicators">
          {#each carouselData as _, i}
            <button
              class="carousel__indicator {i === activeSlideIndex ? 'carousel__indicator--active' : ''}"
              onclick={() => goToIndex(i)}
              aria-label="Go to slide {i + 1}"
            >
              {#if i === activeSlideIndex}
                <div class="carousel__progress" style="width: {progress}%"></div>
              {/if}
            </button>
          {/each}
        </div>
        <button class="carousel__nav-btn" onclick={() => goToNext()} aria-label="Next slide">
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <button
          class="carousel__pause-btn"
          onclick={toggleAutoplay}
          aria-label={autoplayPaused ? "Play carousel" : "Pause carousel"}
        >
          {#if autoplayPaused}
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          {:else}
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          {/if}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .carousel__heading {
    text-shadow:
      2px 2px 8px rgba(0, 0, 0, 0.8),
      0 0 4px rgba(0, 0, 0, 0.9);
    text-transform: uppercase;
    font-size: var(--size-step-3);
    font-weight: 500;
    line-height: 1;
    text-wrap: balance;
    padding: 0;
    margin-block-start: 0.125em;
    margin-inline: 0;

    position: absolute;
    top: var(--header-height);
    left: calc((100% - var(--content-width)) / 2 + 0.75rem);

    z-index: 14;

    @media (min-width: 56rem) {
      font-size: var(--size-step-5);
    }
  }

  .carousel__explore-controls {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    width: 100%;
    padding: 0.875rem 1.25rem;
    box-sizing: border-box;

    @media (min-width: 56rem) {
      padding: 1.125rem 1.5rem;
      gap: 0.75rem;
    }
  }

  .carousel__explore-title {
    font-size: 1.125rem;
    font-weight: 500;
    text-wrap: balance;
    margin-block-start: 0;
    margin-block-end: 0.25lh;

    @media (min-width: 56rem) {
      font-size: 1.325rem;
    }
  }

  .carousel__explore-hints {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .carousel__explore-hint {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--size-step--1);
    color: rgba(255, 255, 255, 0.75);
  }

  .carousel__explore-hint svg {
    opacity: 0.7;
    flex-shrink: 0;
  }

  .carousel__explore-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-block-start: 0.875rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .carousel__exit-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.375rem 0.75rem;
    border: var(--stroke);
    border-radius: var(--radius-xl);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
    font-size: var(--size-step--1);
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .carousel__exit-btn:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: var(--border-color-subtle-hover);
  }

  .carousel__panel {
    position: absolute;
    bottom: 3lvh;
    left: calc((100% - var(--content-width)) / 2 + 0.75rem);
    z-index: 14;

    overflow: hidden;
    width: calc(var(--content-width) - 2rem);
    box-sizing: border-box;
    container-type: inline-size;

    @media (min-width: 40rem) {
      width: 400px;
    }

    @media (min-width: 56rem) {
      width: 500px;
    }
  }

  .carousel__panel-inner {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding-block: 0.75rem;

    @media (min-width: 56rem) {
      padding-block: 1rem;
    }
  }

  .carousel__body {
    padding: 1ch 1.5ch;
    font-size: 0.8125rem;
    max-width: 60ch;
    min-height: 8lh;

    @media (min-width: 56rem) {
      padding: 2ch 2ch;
      font-size: 0.875rem;
    }
  }

  .carousel__title {
    font-size: 1.125rem;
    text-wrap: balance;
    margin-block-start: 0lh;
    margin-block-end: 0.25lh;

    @media (min-width: 56rem) {
      font-size: 1.325rem;
    }
  }

  .carousel__controls {
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

  .carousel__nav-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.1);
    border: var(--stroke);
    border-radius: 50%;
    cursor: pointer;
    color: currentColor;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;

    @container (min-width: 350px) {
      display: flex;
    }
  }

  .carousel__nav-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: var(--border-color-subtle-hover);
  }

  .carousel__pause-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.1);
    border: var(--stroke);
    border-radius: 50%;
    cursor: pointer;
    color: currentColor;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
  }

  .carousel__pause-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: var(--border-color-subtle-hover);
  }

  .carousel__indicators {
    display: none;
    gap: 8px;

    @container (min-width: 380px) {
      display: flex;
    }
  }

  .carousel__indicator {
    position: relative;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: var(--radius-s);
    cursor: pointer;
    overflow: hidden;
    padding: 0;
    display: flex;
    align-items: center;
  }

  .carousel__indicator::after {
    content: "";
    display: block;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: var(--radius-s);
    transition: background 0.2s ease;
  }

  .carousel__indicator:hover::after {
    background: rgba(255, 255, 255, 0.5);
  }

  .carousel__indicator--active::after {
    background: rgba(255, 255, 255, 0.3);
  }

  .carousel__progress {
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    height: 4px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: var(--radius-s);
    transition: width 0.05s linear;
  }
</style>
