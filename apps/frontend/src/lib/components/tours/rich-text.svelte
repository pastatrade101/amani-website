<script lang="ts">
	import { sanitizeRichText } from '$lib/tour-html';

	// CMS rich text, passed through the page's own allow-list before {@html}.
	let { value, class: className = '' }: { value?: string | null; class?: string } = $props();
	let html = $derived(sanitizeRichText(value));
</script>

{#if html}
	<div class={`rich-text ${className}`}>{@html html}</div>
{/if}

<style>
	.rich-text { font-size: 14px; line-height: 1.85; color: color-mix(in oklch, var(--navy) 80%, white); overflow-wrap: anywhere; }
	.rich-text :global(p + p), .rich-text :global(p + ul), .rich-text :global(p + ol), .rich-text :global(ul + p), .rich-text :global(ol + p), .rich-text :global(ul + ul), .rich-text :global(ol + ol) { margin-top: 0.85em; }
	.rich-text :global(ul) { list-style: disc; padding-left: 1.25rem; }
	.rich-text :global(ol) { list-style: decimal; padding-left: 1.25rem; }
	.rich-text :global(li + li) { margin-top: 0.3em; }
	.rich-text :global(strong) { font-weight: 600; color: var(--navy); }
	.rich-text :global(a) { color: var(--navy); font-weight: 500; text-decoration: underline; text-underline-offset: 3px; }
	@media (min-width: 640px) { .rich-text { font-size: 15px; line-height: 1.9; } }
</style>
