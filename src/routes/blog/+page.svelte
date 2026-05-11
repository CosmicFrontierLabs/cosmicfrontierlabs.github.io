<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Blog - Cosmic Frontier Labs</title>
</svelte:head>

<section class="flow blog">
  <h1>Blog</h1>
  <a class="button blog__rss-link" data-type="ghost" data-smaller href="/rss.xml" type="application/rss+xml">
    Subscribe via RSS
  </a>

  {#if data.posts.length > 0}
    <ul class="flow">
      {#each data.posts as post}
        <li>
          <article>
            <h2>
              <a href={post.url}>{post.title}</a>
            </h2>
            <time datetime={post.date}>
              {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </time>
          </article>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="blog__coming-soon">Blog coming soon</p>
  {/if}
</section>

<style>
  .blog ul {
    padding-inline: 0;
    max-width: 800px;
    margin-block-start: var(--space-m);
    font-size: var(--size-step--1);
  }

  .blog__rss-link {
    --button-text: var(--color-primary-light);
    --button-border: 1px solid var(--color-primary-dark);
    --button-border-radius: var(--radius-xl);
    --button-x-padding: 0.9em;
    --button-y-padding: 0.35em;
    margin-block-start: var(--space-2xs);
  }

  .blog li {
    list-style: none;
  }

  .blog article {
    display: flex;
    row-gap: var(--space-3xs);
    column-gap: var(--space-s);
    align-items: baseline;
    flex-wrap: wrap;
  }

  .blog article h2 {
    margin: 0;
    font-size: inherit;
    max-width: none;
    font-family: var(--font-sans);
    font-weight: 400;
  }

  .blog article time {
    opacity: 0.9;
    font-size: var(--size-step--2);
    white-space: nowrap;
  }

  .blog__coming-soon {
    max-width: 800px;
    margin-block-start: var(--space-l);
    font-size: var(--size-step--1);
    opacity: 0.9;
  }
</style>
