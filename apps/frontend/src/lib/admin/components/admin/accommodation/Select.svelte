<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import * as CmsSelect from '$lib/components/ui/native-select';
export let label='';export let value:any='';export let options:string[]=[];export let labels:Record<string,string>={};export let name='';export let error='';</script>
<CmsLabel data-field-path={name || undefined} class="grid min-w-0 gap-1 text-sm font-semibold text-ink"><span>{label}</span><CmsSelect.Root {name} class={`h-10 min-w-0 rounded-lg border bg-surface px-3 font-normal outline-none ${error?'border-red-400 focus:border-red-500':'border-ink/15 focus:border-forest'}`} aria-invalid={error?'true':undefined} bind:value><CmsSelect.Option value="">Select…</CmsSelect.Option>{#each options as option}<CmsSelect.Option value={option}>{labels[option]??option.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</CmsSelect.Option>{/each}</CmsSelect.Root>{#if error}<small class="font-medium text-red-600">{error}</small>{/if}</CmsLabel>
