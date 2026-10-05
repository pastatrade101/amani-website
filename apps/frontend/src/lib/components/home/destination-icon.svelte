<script lang="ts">
 import { Mountain, Palmtree, Trees, Waves, Compass, Landmark } from '@lucide/svelte';
 let { name, compact = false }: { name: string; compact?: boolean } = $props();
 let kind = $derived(/zanzibar|pemba|mafia|coast|beach/i.test(name) ? 'coast' : /kilimanjaro|mount|ngorongoro|crater/i.test(name) ? 'mountain' : /lake|manyara|tanganyika/i.test(name) ? 'water' : /town|city|dar es|arusha/i.test(name) ? 'town' : name === 'all' ? 'all' : 'wild');
 let Icon = $derived(({ coast: Palmtree, mountain: Mountain, water: Waves, town: Landmark, all: Compass, wild: Trees })[kind]);
</script>
<span class="destination-art" class:compact data-kind={kind} aria-hidden="true"><Icon class={compact ? 'size-5' : 'size-7'} strokeWidth={1.35} /></span>
<style>.destination-art{display:grid;place-items:center;flex-shrink:0;width:48px;height:48px;border-radius:14px;background:#f5f0df;color:#8c7023}.destination-art[data-kind=coast],.destination-art[data-kind=water]{background:#edf4f7;color:#376580}.destination-art[data-kind=wild]{background:#edf3ee;color:#456b52}.destination-art[data-kind=mountain]{background:#f0eef5;color:#626081}.destination-art.compact{width:32px;height:32px;border-radius:9px}</style>
