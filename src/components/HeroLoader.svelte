<script lang="ts">
  interface Props {
    visible: boolean;
  }

  let { visible }: Props = $props();
</script>

<div class="hero-loader" class:hero-loader--hidden={!visible}>
  <svg class="hero-loader__orbit" viewBox="0 0 100 100" aria-hidden="true">
    <!-- Whole SVG rotation -->
    <animateTransform
      attributeName="transform"
      type="rotate"
      from="0 50 50"
      to="360 50 50"
      dur="12s"
      repeatCount="indefinite"
    />
    <!-- Outer ring -->
    <circle class="hero-loader__ring hero-loader__ring--outer" cx="50" cy="50" r="44">
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 50 50"
        to="-360 50 50"
        dur="20s"
        repeatCount="indefinite"
      />
    </circle>
    <!-- Middle ring -->
    <circle class="hero-loader__ring hero-loader__ring--middle" cx="50" cy="50" r="30" />
    <!-- Inner ring -->
    <circle class="hero-loader__ring hero-loader__ring--inner" cx="50" cy="50" r="16" />
    <!-- Orbiting dot -->
    <circle class="hero-loader__dot" cx="50" cy="6" r="2.5" />
  </svg>
  <p class="hero-loader__text">LOADING</p>
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
    gap: var(--space-s);
    opacity: 1;
    transition: opacity 0.3s linear;
  }

  .hero-loader--hidden {
    opacity: 0;
    pointer-events: none;
  }

  .hero-loader__orbit {
    width: clamp(80px, 20vw, 140px);
    height: clamp(80px, 20vw, 140px);
  }

  .hero-loader__ring {
    fill: none;
    stroke-width: 0.5;
    stroke-linecap: round;
  }

  .hero-loader__ring--outer {
    stroke: var(--color-gray-400);
    stroke-dasharray: 8 12;
  }

  .hero-loader__ring--middle {
    stroke: var(--color-gray-500);
    stroke-dasharray: 60 130;
    animation: loader-pulse 3s ease-in-out infinite;
  }

  .hero-loader__ring--inner {
    stroke: var(--color-primary-light);
    stroke-dasharray: 20 80;
    stroke-width: 0.8;
    animation: loader-dash 2s ease-in-out infinite;
  }

  .hero-loader__dot {
    fill: var(--color-primary-light);
    filter: drop-shadow(0 0 3px var(--color-primary-light));
  }

  .hero-loader__text {
    font-family: var(--font-mono);
    font-size: var(--size-step--2);
    letter-spacing: 0.3em;
    color: var(--color-text-mid);
    animation: loader-text-pulse 2s ease-in-out infinite;
  }

  @keyframes loader-dash {
    0%, 100% { stroke-dasharray: 20 80; }
    50% { stroke-dasharray: 60 40; }
  }

  @keyframes loader-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  @keyframes loader-text-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
</style>
