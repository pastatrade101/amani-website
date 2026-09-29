<script lang="ts">export let title='';export let note='';</script>
<section class="rounded-[12px] border border-ink/10 bg-surface p-4 shadow-sm md:p-5"><h3 class="text-lg font-bold text-heading">{title}</h3>{#if note}<p class="mt-0.5 text-xs text-ink/55">{note}</p>{/if}<div class="mt-4 grid gap-4"><slot/></div></section>
