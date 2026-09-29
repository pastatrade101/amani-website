<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';
export let label='';export let checked:any=false;</script>
<CmsLabel class="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-ink/10 bg-sand/20 px-3 text-sm font-semibold text-ink"><CmsCheckbox class="h-4 w-4 accent-forest"  bind:checked/>{label}</CmsLabel>
