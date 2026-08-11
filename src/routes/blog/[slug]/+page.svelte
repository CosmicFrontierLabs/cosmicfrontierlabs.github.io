<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.title || "Blog Post"} - Cosmic Frontier Labs</title>
</svelte:head>

<section class="flow blog-post">
  <h1>{data.title || "Blog Post"}</h1>
  <data.component />
</section>
