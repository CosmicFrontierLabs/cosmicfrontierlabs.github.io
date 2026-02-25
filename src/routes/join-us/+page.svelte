<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();

	onMount(() => {
		const rot13 = (str: string) =>
			str.replace(/[a-zA-Z]/g, (c) =>
				String.fromCharCode(
					(c <= 'Z' ? 90 : 122) >= c.charCodeAt(0) + 13
						? c.charCodeAt(0) + 13
						: c.charCodeAt(0) - 13
				)
			);

		document.querySelectorAll('.obfuscated-email').forEach((el) => {
			const encoded = el.getAttribute('data-encoded');
			if (encoded) {
				const decoded = rot13(encoded);
				el.textContent = decoded;
				el.setAttribute('href', `mailto:${decoded}`);
			}
		});
	});
</script>

<svelte:head>
	<title>Join Us - Cosmic Frontier Labs</title>
</svelte:head>

<section class="flow join-us">
	<h1>Join Us</h1>
	<p class="join-us__subtitle">
		Telescope wanted for hazardous journey. Vacuum, radiation, thermal extremes. Safe return
		doubtful. Honour and recognition in event of success.
	</p>
	<p class="join-us__cta">Help us build it.</p>
	<p class="join-us__apply">
		To apply, email <a class="obfuscated-email" data-encoded={data.obfuscatedEmail} href="/contact"
			>[enable JavaScript to see email]</a
		>
		with the subject line including <strong>"{data.keyword}"</strong> and the position title.
	</p>
	{#if data.positions.length > 0}
		<div class="join-us__positions flow">
			{#each data.positions as position}
				<details class="join-us__position">
					<summary>
						<span class="join-us__position-title">{position.title}</span>
						<span class="join-us__position-location">{position.location}</span>
					</summary>
					<div class="join-us__position-description">
						{#each position.descriptionBlocks as block}
							{#if block.type === 'paragraph'}
								<p>{block.text}</p>
							{:else}
								<ul>
									{#each block.items as item}
										<li>{item}</li>
									{/each}
								</ul>
							{/if}
						{/each}
					</div>
				</details>
			{/each}
		</div>
	{:else}
		<p class="join-us__coming-soon">Job posts coming soon</p>
	{/if}
</section>

<style>
	.join-us__positions {
		--flow-space: var(--space-s);
		max-width: 800px;
		margin-block-start: var(--space-l);
	}

	.join-us__position {
		border: var(--stroke-solid);
		padding: var(--space-s);
	}

	.join-us__position[open] {
		padding-block-end: var(--space-m);
	}

	.join-us__position summary {
		cursor: pointer;
		display: flex;
		flex-wrap: wrap;
		row-gap: var(--space-3xs);
		column-gap: var(--space-s);
		align-items: baseline;
		list-style: none;
	}

	.join-us__position summary::-webkit-details-marker {
		display: none;
	}

	.join-us__position summary::before {
		content: '+';
		font-weight: 400;
		margin-inline-end: var(--space-xs);
	}

	.join-us__position[open] summary::before {
		content: '−';
	}

	.join-us__position-title {
		font-weight: 500;
	}

	.join-us__position-location {
		color: var(--color-text-mid);
		font-size: var(--size-step--1);
	}

	.join-us__position-description {
		margin-block-start: var(--space-m);
		padding-inline-start: var(--space-m);
		font-size: var(--size-step--1);
		max-width: 60ch;
	}

	.join-us__position-description p {
		margin-block: var(--space-s);
	}

	.join-us__position-description ul {
		margin-block: var(--space-s);
		padding-inline-start: var(--space-m);
	}

	.join-us__position-description li {
		margin-block: var(--space-2xs);
	}

	.join-us__apply {
		margin-block-start: var(--space-l);
		padding-block-start: var(--space-m);
		border-top: var(--stroke-solid);
		font-size: var(--size-step--1);
	}

	.join-us__coming-soon {
		max-width: 800px;
		margin-block-start: var(--space-l);
		font-size: var(--size-step--1);
		opacity: 0.9;
	}

	.join-us__subtitle {
		max-width: 50ch;
		font-size: var(--size-step-0);
		font-style: italic;
		margin: 0;
	}

	.join-us__cta {
		font-size: var(--size-step-1);
		font-weight: 600;
		font-style: normal;
		margin-block-start: var(--space-m);
	}
</style>
