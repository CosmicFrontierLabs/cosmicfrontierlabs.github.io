<script lang="ts">
  import HomePage from "../components/HomePage.svelte";

  let { data } = $props();
</script>

<HomePage carouselData={data.carouselData} />
