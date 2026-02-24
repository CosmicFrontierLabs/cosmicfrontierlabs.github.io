<script lang="ts">
	import '../styles/main.scss';
	import Header from '../components/Header.svelte';
	import Footer from '../components/Footer.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		let resizeTimer: ReturnType<typeof setTimeout>;
		const handler = () => {
			document.body.classList.add('resize-animation-stopper');
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				document.body.classList.remove('resize-animation-stopper');
			}, 400);
		};
		window.addEventListener('resize', handler);
		return () => window.removeEventListener('resize', handler);
	});
</script>

<div>
	<Header />
</div>
<main id="content">
	{@render children()}
</main>
<Footer />
