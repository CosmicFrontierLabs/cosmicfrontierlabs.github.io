<script lang="ts">
	// A good, but dense, guide for menus is this:
	// https://piccalil.li/blog/build-a-fully-responsive-progressively-enhanced-burger-menu/
	const navItems = [
		{
			label: "Blog",
			href: "/blog",
		},
		{
			label: "Join Us",
			href: "/join-us",
		},
		{
			label: "Contact",
			href: "/contact",
		},
	];

	let isMenuExpanded = $state(false);

	function trackHeaderHeight(node: HTMLElement) {
		const observer = new ResizeObserver((entries) => {
			if (entries.length > 0) {
				const entry = entries[0];
				// Add 32px to account for margins
				const height = entry.contentRect.height + 32;
				document.documentElement.style.setProperty("--header-height", `${height}px`);
			}
		});
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}
</script>

<header class="site-header" use:trackHeaderHeight>
	<div class="site-header__inner site-header-repel">
		<a class="skip-link visually-hidden" href="#content">Skip to main content</a>
		<div class="site-header__logo">
			<a href="/" class="site-header__logo-link">Cosmic Frontier Labs</a>
		</div>
		<div class="site-header__nav-wrapper">
			<button
				class="site-header__nav-toggle"
				type="button"
				aria-label={isMenuExpanded ? 'Close menu' : 'Open menu'}
				aria-controls="primary-nav"
				aria-expanded={isMenuExpanded}
				onclick={() => (isMenuExpanded = !isMenuExpanded)}
			>
				<span class="visually-hidden" aria-hidden="true">Menu</span>
				{#if isMenuExpanded}
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M18 6 6 18"/>
						<path d="m6 6 12 12"/>
					</svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="4" x2="20" y1="12" y2="12"/>
						<line x1="4" x2="20" y1="6" y2="6"/>
						<line x1="4" x2="20" y1="18" y2="18"/>
					</svg>
				{/if}
			</button>
			<nav class="site-header__nav" id="primary-nav">
				<ul role="list" class="site-header__nav-list" data-visible={isMenuExpanded}>
					{#each navItems as item}
						<li>
							<a href={item.href} class="site-header__nav-list-item">
								{item.label}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</div>
	</div>
</header>
