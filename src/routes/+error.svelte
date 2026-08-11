<script lang="ts">
  let { status, error } = $props();

  const message =
    error && typeof error === "object" && "message" in error ? String(error.message) : "The page could not be found.";
</script>

<svelte:head>
  <title>Something Went Wrong - Cosmic Frontier Labs</title>
</svelte:head>

<section class="error-page flow">
  <p class="error-page__status">{status}</p>
  <h1>Something went wrong</h1>
  <p class="error-page__message">{message}</p>
  <p>
    <a href="/">Go back home</a>
    ·
    <a href="/blog">Read the blog</a>
  </p>
</section>

<style>
  .error-page {
    min-height: 50svh;
    display: grid;
    align-content: center;
    justify-items: start;
    max-width: 60ch;
  }

  .error-page__status {
    margin: 0;
    font-family: var(--font-mono);
    color: var(--color-text-mid);
  }

  .error-page__message {
    color: var(--color-text-mid);
  }
</style>
