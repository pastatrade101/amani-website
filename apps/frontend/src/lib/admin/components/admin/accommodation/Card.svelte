<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';
import{Trash2}from'@lucide/svelte';export let title='';export let remove:()=>void=()=>{};</script>
<article class="rounded-xl border border-ink/10 bg-sand/15 p-3.5"><div class="mb-3 flex items-center justify-between"><h4 class="text-sm font-bold text-heading">{title}</h4><CmsButton variant="ghost" class="grid h-7 w-7 place-items-center rounded-md text-red-600 hover:bg-red-50" type="button" aria-label="Remove" onclick={remove}><Trash2 size={14}/></CmsButton></div><div class="grid gap-3"><slot/></div></article>
