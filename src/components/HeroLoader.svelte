<script lang="ts">
  interface Props {
    visible: boolean;
  }

  let { visible }: Props = $props();
</script>

<div class="hero-loader" class:hero-loader--hidden={!visible} role="status" aria-live="polite">
  {#if visible}
    <p class="hero-loader__text">
      Loading<span class="hero-loader__dot hero-loader__dot--1">.</span><span
        class="hero-loader__dot hero-loader__dot--2">.</span
      ><span class="hero-loader__dot hero-loader__dot--3">.</span>
    </p>
  {/if}
</div>

<style lang="scss">
  .hero-loader {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    transition: opacity 0.3s linear;
  }

  .hero-loader--hidden {
    opacity: 0;
    pointer-events: none;
  }

  .hero-loader__text {
    font-family: var(--font-mono);
    font-size: var(--size-step--1);
    letter-spacing: 0.25em;
    color: var(--color-text);
  }

  @media (prefers-reduced-motion: no-preference) {
    .hero-loader__dot {
      animation: dot-fade 1.5s ease-in-out infinite;
    }

    .hero-loader__dot--1 {
      animation-delay: 0s;
    }
    .hero-loader__dot--2 {
      animation-delay: 0.2s;
    }
    .hero-loader__dot--3 {
      animation-delay: 0.4s;
    }
  }

  @keyframes dot-fade {
    0%,
    100% {
      opacity: 0;
    }
    30%,
    70% {
      opacity: 1;
    }
  }
</style>
