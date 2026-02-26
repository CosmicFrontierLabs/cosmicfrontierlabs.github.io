<script lang="ts">
  import "../styles/main.scss";
  import Header from "../components/Header.svelte";
  import Footer from "../components/Footer.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { afterNavigate } from "$app/navigation";

  let { children } = $props();

  onMount(() => {
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handler = () => {
      document.body.classList.add("resize-animation-stopper");
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        document.body.classList.remove("resize-animation-stopper");
      }, 400);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  });

  afterNavigate(() => {
    const main = document.getElementById("content");
    if (main) {
      main.focus({ preventScroll: true });
    }
  });
</script>

<Header />
<main id="content" tabindex="-1">
  {@render children()}
</main>
<Footer />

<style>
  main:focus {
    outline: none;
  }
</style>
