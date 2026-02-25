<script lang="ts">
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
	let navListEl: HTMLUListElement | null = $state(null);
	let toggleBtnEl: HTMLButtonElement | null = $state(null);

	function toggleMenu() {
		isMenuExpanded = !isMenuExpanded;
		if (isMenuExpanded) {
			requestAnimationFrame(() => {
				const firstLink = navListEl?.querySelector('a');
				firstLink?.focus();
			});
		}
	}

	function closeMenu() {
		isMenuExpanded = false;
		toggleBtnEl?.focus();
	}

	function handleNavKeydown(e: KeyboardEvent) {
		if (!isMenuExpanded) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			closeMenu();
		}
	}

	function trackHeaderHeight(node: HTMLElement) {
		const observer = new ResizeObserver((entries) => {
			if (entries.length > 0) {
				const entry = entries[0];
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
				bind:this={toggleBtnEl}
				class="site-header__nav-toggle"
				type="button"
				aria-label={isMenuExpanded ? 'Close menu' : 'Open menu'}
				aria-controls="primary-nav"
				aria-expanded={isMenuExpanded}
				onclick={toggleMenu}
			>
				{#if isMenuExpanded}
					<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M18 6 6 18"/>
						<path d="m6 6 12 12"/>
					</svg>
				{:else}
					<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="4" x2="20" y1="12" y2="12"/>
						<line x1="4" x2="20" y1="6" y2="6"/>
						<line x1="4" x2="20" y1="18" y2="18"/>
					</svg>
				{/if}
			</button>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<nav class="site-header__nav" id="primary-nav" onkeydown={handleNavKeydown}>
				<ul
					bind:this={navListEl}
					role="list"
					class="site-header__nav-list"
					data-visible={isMenuExpanded}
				>
					{#each navItems as item}
						<li>
							<a
								href={item.href}
								class="site-header__nav-list-item"
								onclick={() => { isMenuExpanded = false; }}
							>
								{item.label}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</div>
	</div>
</header>
