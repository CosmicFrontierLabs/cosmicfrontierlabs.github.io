<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";

  const kitFormOptions = {
    settings: {
      after_subscribe: {
        action: "message",
        success_message: "Success! You're on the list.",
        redirect_url: "",
      },
    },
    version: "5",
  };

  let isRoot = $derived(page.url.pathname === "/");

  onMount(() => {
    const script = document.createElement("script");
    script.src = "https://f.convertkit.com/ckjs/ck.5.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  });
</script>

<footer class="footer">
  {#if isRoot}
    <div class="footer-cta">
      <p class="footer-cta__title">Cosmic Frontier Labs</p>
      <nav class="footer-nav" aria-label="Footer">
        <a href="/blog">blog</a>
        <span aria-hidden="true" class="dot-separator"></span>
        <a href="/join-us">join us</a>
        <span aria-hidden="true" class="dot-separator"></span>
        <a href="/contact">contact</a>
      </nav>
    </div>
  {/if}

  <div class="footer-bottom">
    <div class="footer-brand">
      <p>
        Cosmic Frontier Labs
        <br />
        USA, Earth, Milky Way, Laniakea Supercluster
      </p>
    </div>

    <div class="footer-signup flow">
      <h3 class="footer-signup-title">Get updates</h3>
      <p>Sign up for mission updates and new roles.</p>
      <form
        class="footer-signup-form formkit-form"
        action="https://app.kit.com/forms/8948798/subscriptions"
        method="post"
        data-sv-form="8948798"
        data-uid="170ae5b1d6"
        data-format="inline"
        data-version="5"
        data-options={JSON.stringify(kitFormOptions)}
      >
        <ul
          class="footer-alerts formkit-alert formkit-alert-error"
          data-element="errors"
          data-group="alert"
          role="alert"
          aria-live="polite"
        ></ul>
        <div class="footer-fields" data-element="fields" data-stacked="false">
          <label class="visually-hidden" for="updates-email">Email address</label>
          <input
            id="updates-email"
            name="email_address"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
          />
          <button class="button formkit-submit" type="submit" data-element="submit" data-smaller>Join list</button>
        </div>
      </form>
    </div>
  </div>
</footer>

<style>
  .footer {
    background: var(--body-bg);
    color: var(--color-text);
    z-index: var(--z-footer);
    position: relative;
  }

  /* ── CTA hero section ── */
  .footer-cta {
    min-height: 80lvh;
    width: 100lvw;
    margin-inline: calc(50% - 50lvw);
    overflow: hidden;
    background: var(--body-bg);
    z-index: var(--z-join-us);
    position: relative;

    display: grid;
    place-content: center;
    text-align: center;
    padding-inline: var(--space-m);

    & .footer-cta__title {
      font-size: var(--size-step-4);
      font-weight: 700;
      text-transform: uppercase;
      text-shadow:
        2px 2px 8px rgba(0, 0, 0, 0.8),
        0 0 4px rgba(0, 0, 0, 0.9);

      @media (min-width: 56rem) {
        font-size: var(--size-step-5);
      }
    }
  }

  .footer-nav {
    margin-block-start: var(--space-s);
    display: flex;
    gap: var(--space-m);
    justify-content: center;
    align-items: center;
    text-shadow:
      2px 2px 8px rgba(0, 0, 0, 0.8),
      0 0 4px rgba(0, 0, 0, 0.9);

    & a {
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .dot-separator {
    height: 0.25em;
    aspect-ratio: 1 / 1;
    background: var(--color-text);
    border-radius: 50%;
  }

  /* ── Bottom bar ── */
  .footer-bottom {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-end;
    gap: var(--space-l);

    max-width: var(--content-width);
    margin-inline: auto;
    padding-block: var(--space-xl) var(--space-l);
  }

  .footer-brand {
    max-width: 28ch;
    font-size: var(--size-step--1);
    color: var(--color-text-mid);

    & p {
      margin-block-start: 0;
    }
  }

  /* ── Signup ── */
  .footer-signup {
    max-width: 28rem;
  }

  .footer-signup-title {
    font-size: var(--size-step-0);
    text-transform: uppercase;
    margin: 0;
  }

  .footer-signup-form {
    display: grid;
    gap: var(--space-xs);
  }

  .footer-alerts {
    margin: 0;
    padding: var(--space-xs);
    border-radius: var(--radius-s);
    border: var(--stroke-solid);
    background: var(--body-bg);
    color: var(--color-text);
    font-size: var(--size-step--2);
    list-style: none;

    &:empty {
      display: none;
    }

    &:global(.formkit-alert-success) {
      border-color: var(--color-primary);
    }
  }

  .footer-fields {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-xs);
    align-items: center;

    @media (max-width: 40rem) {
      grid-template-columns: 1fr;
    }
  }
</style>
