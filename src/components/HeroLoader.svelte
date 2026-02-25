<script lang="ts">
  interface Props {
    visible: boolean;
  }

  let { visible }: Props = $props();
</script>

<div class="hero-loader" class:hero-loader--hidden={!visible}>
  <svg class="hero-loader__spinner" viewBox="0 0 50 50" aria-hidden="true">
    <circle cx="25" cy="25" r="20" fill="none" stroke="var(--color-gray-500)" stroke-width="2" />
    <circle cx="25" cy="25" r="20" fill="none" stroke="var(--color-primary-light)" stroke-width="2"
      stroke-dasharray="31.4 94.2" stroke-linecap="round">
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 25 25"
        to="360 25 25"
        dur="0.8s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
  <p class="hero-loader__text">Loading</p>
</div>

<style lang="scss">
  .hero-loader {
    position: absolute;
    height: 80lvh;
    width: 100%;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    opacity: 1;
    transition: opacity 0.3s linear;
  }

  .hero-loader--hidden {
    opacity: 0;
    pointer-events: none;
  }

  .hero-loader__spinner {
    width: 32px;
    height: 32px;
  }

  .hero-loader__text {
    font-family: var(--font-mono);
    font-size: var(--size-step--2);
    letter-spacing: 0.2em;
    color: var(--color-text-mid);
  }
</style>
