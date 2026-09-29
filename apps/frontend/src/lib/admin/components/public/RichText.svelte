<script lang="ts">
  /**
   * Renders a long-form CMS field, whether it holds rich text or the plain text
   * that was there before the editor existed.
   *
   * The same predicate decides here and on the server: if the value carries
   * markup it is sanitized and injected; if it does not, it goes down the
   * escaped plain-text path and cannot execute whatever it contains. So this is
   * a second, independent gate rather than a substitute for sanitizing on save.
   *
   * Typography lives in this component so every long-form field on the site
   * reads the same. Pass size/colour through `className` — children inherit it.
   */
  import { hasRichContent, looksLikeHtml, sanitizeRichText } from '$lib/admin/richText';

  export let value: string | null | undefined = '';
  /** Extra classes on the wrapper — children inherit size and colour from it. */
  export let className = '';
  /** Renders nothing at all when the field is empty, so callers can gate on it. */
  export let element: 'div' | 'article' = 'div';

  $: raw = String(value ?? '');
  $: isRich = looksLikeHtml(raw);
  $: html = isRich ? sanitizeRichText(raw) : '';
  // Pre-editor content: blank lines separate paragraphs, single newlines are
  // line breaks (preserved by white-space: pre-line rather than by <br>).
  $: paragraphs = isRich
    ? []
    : raw
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
  $: visible = hasRichContent(raw);
</script>

{#if visible}
  <svelte:element this={element} class="rich {className}">
    {#if isRich}
      {@html html}
    {:else}
      {#each paragraphs as paragraph}
        <p class="whitespace-pre-line">{paragraph}</p>
      {/each}
    {/if}
  </svelte:element>
{/if}

<style>
  /* {@html} output is not scoped by Svelte, so these have to be :global — but
     they stay nested under .rich, which keeps them off the rest of the page. */
  .rich > :global(* + *) {
    margin-top: 1.15em;
  }

  .rich :global(h2),
  .rich :global(h3),
  .rich :global(h4) {
    font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
    font-weight: 600;
    line-height: 1.25;
    color: rgb(var(--c-heading));
  }

  .rich :global(h2) {
    font-size: 1.5em;
    margin-top: 1.9em;
  }

  .rich :global(h3) {
    font-size: 1.25em;
    margin-top: 1.7em;
  }

  .rich :global(h4) {
    font-size: 1.08em;
    margin-top: 1.5em;
  }

  .rich :global(h2:first-child),
  .rich :global(h3:first-child),
  .rich :global(h4:first-child) {
    margin-top: 0;
  }

  .rich :global(ul),
  .rich :global(ol) {
    padding-left: 1.3em;
  }

  .rich :global(ul) {
    list-style: disc;
  }

  .rich :global(ol) {
    list-style: decimal;
  }

  .rich :global(li) {
    padding-left: 0.25em;
  }

  .rich :global(li + li) {
    margin-top: 0.5em;
  }

  .rich :global(li::marker) {
    color: rgb(var(--c-goldfinch-gold));
  }

  /* A quote is set off by a gold rule rather than a box, to match the editorial
     styling the rest of the site uses. */
  .rich :global(blockquote) {
    border-left: 2px solid rgb(var(--c-goldfinch-gold));
    padding-left: 1.15em;
    font-style: italic;
    color: rgb(var(--c-heading));
  }

  .rich :global(strong) {
    font-weight: 700;
    color: rgb(var(--c-heading));
  }

  .rich :global(a) {
    color: rgb(var(--c-forest));
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-color: rgb(var(--c-goldfinch-gold));
    transition: color 0.15s ease;
  }

  .rich :global(a:hover) {
    color: rgb(var(--c-deep-green));
  }

  .rich :global(a:focus-visible) {
    outline: 2px solid rgb(var(--c-goldfinch-gold));
    outline-offset: 2px;
    border-radius: 2px;
  }

  .rich.rich-on-dark :global(h2),
  .rich.rich-on-dark :global(h3),
  .rich.rich-on-dark :global(h4),
  .rich.rich-on-dark :global(strong) {
    color: inherit;
  }

  .rich.rich-on-dark :global(a) {
    color: rgb(var(--c-goldfinch-gold));
  }
</style>
