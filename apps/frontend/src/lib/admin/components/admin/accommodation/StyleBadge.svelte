<script lang="ts">
  import { SAFARI_STYLE_THEME, type SafariStyle } from '$lib/safari-pricing';
  import { STYLE_ICONS } from './property';

  export let style: SafariStyle;
  export let label: string;
  /** Rings the badge amber, e.g. a tour using this lodge for a style it is not set to. */
  export let warn = false;

  $: theme = SAFARI_STYLE_THEME[style];
  $: Icon = STYLE_ICONS[style];
</script>

<!-- Text stays dark: the midrange yellow is too light to read as small text. -->
<span
  class={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold text-heading ${warn ? 'ring-2 ring-amber-400/60' : ''}`}
  style={`background:${theme.light};border-color:${theme.primary}`}
>
  <Icon size={12} class="shrink-0" style={`color:${theme.priceColor}`} aria-hidden="true" />
  <span class="truncate">{label}</span>
</span>
