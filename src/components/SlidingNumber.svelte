<script lang="ts">
  import gsap from "gsap";

  interface Props {
    currentNumber: string;
  }

  let { currentNumber }: Props = $props();

  // All possible numbers (01, 02, 03 based on usage)
  const numbers = ["01", "02", "03"];
  
  let carouselEl: HTMLElement | null = $state(null);
  let prevIndex = $state<number | null>(null);
  let currentIndex = $derived(numbers.indexOf(currentNumber));

  // Calculate slide height based on container height (1.2em per number)
  const getSlideHeight = (): number => {
    if (!carouselEl) return 0;
    // Each number is 1.2em tall, so total carousel height is numbers.length * 1.2em
    // Slide height is the height of one number
    return carouselEl.offsetHeight / numbers.length;
  };

  // Handle initialization and updates in a single effect
  $effect(() => {
    const targetIndex = currentIndex;
    const previousIndex = prevIndex;
    
    // Skip if invalid index
    if (targetIndex < 0) return;
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      if (!carouselEl) return;
      
      const slideHeight = getSlideHeight();
      if (slideHeight === 0) return;
      
      // Initialize position on first mount (no animation)
      if (previousIndex === null) {
        gsap.set(carouselEl, { y: -targetIndex * slideHeight });
        prevIndex = targetIndex;
        return;
      }
      
      // Skip if no change
      if (targetIndex === previousIndex) return;
      
      // Calculate the step difference
      const stepDiff = targetIndex - previousIndex;
      const isIncreasing = stepDiff > 0;
      
      // Create timeline for smooth transitions
      const tl = gsap.timeline({
        onComplete: () => {
          prevIndex = targetIndex;
        }
      });
      
      // If jumping multiple steps, animate through intermediate values
      if (Math.abs(stepDiff) > 1) {
        const steps = Math.abs(stepDiff);
        const stepDuration = 0.5;
        
        // Animate through each intermediate step
        for (let i = 1; i <= steps; i++) {
          const intermediateIndex = previousIndex + (isIncreasing ? i : -i);
          const intermediateY = -intermediateIndex * slideHeight;
          
          tl.to(carouselEl, {
            y: intermediateY,
            duration: stepDuration,
            ease: "power4.out",
          });
        }
      } else {
        // Single step transition
        const targetY = -targetIndex * slideHeight;
        tl.to(carouselEl, {
          y: targetY,
          duration: 0.5,
          ease: "power4.out",
        });
      }
    });
  });
</script>

<div class="sliding-number-container">
  <div class="sliding-number-carousel" bind:this={carouselEl}>
    {#each numbers as number}
      <span class="sliding-number">{number}</span>
    {/each}
  </div>
</div>

<style lang="scss">
  .sliding-number-container {
    font-size: var(--size-step-5);
    font-weight: 500;
    overflow: hidden;
    height: 1em; // Slightly larger than line-height to accommodate animation
    width: 2ch;
    position: relative;
    font-family: var(--font-heading);
  }
  
  .sliding-number-carousel {
    position: relative;
    will-change: transform;
  }
  
  .sliding-number {
    margin-block-start: -.25em;
    display: block;
    width: 2ch;
    height: 1.2em;
    overflow: hidden;
  }
</style>
