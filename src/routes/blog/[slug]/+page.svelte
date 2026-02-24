<script lang="ts">
	let { data } = $props();
</script>

<section class="flow blog-post">
	<h1>{data.title}</h1>
	<data.component />
</section>
