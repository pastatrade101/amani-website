<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Textarea as CmsTextarea } from '$lib/components/ui/textarea';
export let label='';export let value:any='';</script>
<CmsLabel class="grid gap-1 text-sm font-semibold text-ink"><span>{label}</span><CmsTextarea rows={3} class="min-h-20 resize-y rounded-lg border border-ink/15 bg-surface px-3 py-2 font-normal leading-5 outline-none focus:border-forest" bind:value></CmsTextarea></CmsLabel>
