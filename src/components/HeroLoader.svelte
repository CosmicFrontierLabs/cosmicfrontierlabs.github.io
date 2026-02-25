<script lang="ts">
  interface Props {
    visible: boolean;
  }

  let { visible }: Props = $props();
</script>

<div class="hero-loader" class:hero-loader--hidden={!visible}>
  <div class="hero-loader__spinner"></div>
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
    gap: var(--space-m);
    opacity: 1;
    transition: opacity 0.3s linear;
  }

  .hero-loader--hidden {
    opacity: 0;
    pointer-events: none;
  }

  .hero-loader__spinner {
    transform: rotateZ(45deg);
    perspective: 1000px;
    border-radius: 50%;
    width: 80px;
    height: 80px;
    color: #fff;
    position: relative;

    &::before,
    &::after {
      content: '';
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: inherit;
      height: inherit;
      border-radius: 50%;
      transform: rotateX(70deg);
      animation: 1s spin linear infinite;
    }

    &::after {
      color: #e05050;
      transform: rotateY(70deg);
      animation-delay: 0.4s;
    }
  }

  .hero-loader__text {
    font-family: var(--font-mono);
    font-size: var(--size-step--1);
    letter-spacing: 0.25em;
    color: var(--color-text);
  }

  @keyframes spin {
    0%,
    100% { box-shadow: 0.2em 0 0 0 currentcolor; }
    12% { box-shadow: 0.2em 0.2em 0 0 currentcolor; }
    25% { box-shadow: 0 0.2em 0 0 currentcolor; }
    37% { box-shadow: -0.2em 0.2em 0 0 currentcolor; }
    50% { box-shadow: -0.2em 0 0 0 currentcolor; }
    62% { box-shadow: -0.2em -0.2em 0 0 currentcolor; }
    75% { box-shadow: 0 -0.2em 0 0 currentcolor; }
    87% { box-shadow: 0.2em -0.2em 0 0 currentcolor; }
  }
</style>
