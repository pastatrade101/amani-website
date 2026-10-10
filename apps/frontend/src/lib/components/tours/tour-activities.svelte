<script lang="ts">
 import { Clock, Sparkles, ArrowRight } from '@lucide/svelte';
 import { Button } from '$lib/components/ui/button';
 import { Checkbox } from '$lib/components/ui/checkbox';
 import { safeUrl, textContent } from '$lib/home-content';
 import { activityCost } from '$lib/optional-activities';
 import type { TourActivityItem } from '$lib/types/api';
 let { items, canEnquire, compact = false, selectedIds = $bindable([]) }: { items: TourActivityItem[]; canEnquire: boolean; compact?: boolean; selectedIds?: string[] } = $props();
 let sorted = $derived([...items].sort((a,b) => a.sort_order-b.sort_order));
 let optional = $derived(sorted.filter(item => item.is_optional));
 const select = (id: string, checked: boolean) => selectedIds = checked ? [...new Set([...selectedIds,id])] : selectedIds.filter(value => value !== id);
</script>
{#if !compact}<div class="flex flex-wrap items-end justify-between gap-5" data-motion="reveal">
 <div class="max-w-2xl"><p class="eyebrow text-muted-foreground">Experience Tanzania</p><h2 class="section-heading mt-3">Activities on your safari</h2><p class="section-description mt-3">Discover what’s included, then choose the optional experiences you’d love us to arrange.</p></div>
 {#if optional.length}<Button variant="outline" href="#optional-activities" class="rounded-lg">View Optional Activities <ArrowRight class="size-4" /></Button>{/if}
</div>{/if}
{#each [{optional:false,title:'Included experiences'}, {optional:true,title:'Optional activities'}] as group}
 {@const list = sorted.filter(item => item.is_optional === group.optional)}
 {#if list.length}
 <div id={group.optional ? 'optional-activities' : undefined} class="scroll-mt-32 mt-9">
 <h3 class="text-lg font-semibold text-navy">{group.title}</h3>
 <ul class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
 {#each list as item (item.activity.id)}
 {@const activity = item.activity}
 {@const image = safeUrl(activity.hero_image_url || activity.image_url,'')}
 <li data-motion={compact ? undefined : "card"} class={`flex flex-col overflow-hidden rounded-2xl border bg-white ${selectedIds.includes(activity.id) ? 'border-navy ring-2 ring-sun/40' : 'border-border'}`}>
 {#if image && !image.startsWith('#')}<img src={image} alt={activity.name} loading="lazy" class="aspect-[16/9] w-full object-cover" />{:else}<div class={`grid place-items-center bg-sun/10 text-navy ${compact ? "h-20" : "aspect-[16/9]"}`}><Sparkles class="size-8" /></div>{/if}
 <div class="flex flex-1 flex-col p-5">
 <span class={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.is_optional ? 'bg-sun/25 text-navy' : 'bg-secondary text-navy'}`}>{item.is_optional ? 'Optional Activity' : 'Included in your safari'}</span>
 <h4 class="mt-3 text-lg font-semibold leading-snug text-navy">{activity.name}</h4>
 {#if activity.description}<p class="mt-2 text-sm leading-6 text-muted-foreground">{textContent(activity.description)}</p>{/if}
 {#if activity.duration_label}<p class="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock class="size-3.5" />{activity.duration_label}</p>{/if}
 <p class="mt-auto pt-4 text-sm font-semibold text-navy">{item.is_optional ? activityCost(item) : 'Included in the tour'}</p>
 {#if item.is_optional && canEnquire}<label class="mt-4 flex cursor-pointer items-start gap-3 border-t border-border pt-4 text-xs font-medium leading-5"><Checkbox checked={selectedIds.includes(activity.id)} onCheckedChange={(checked) => select(activity.id,checked === true)} aria-label={`Include ${activity.name} in my safari`} /><span>Include This Activity in My Safari</span></label>{/if}
 </div></li>
 {/each}</ul></div>
 {/if}
{/each}
{#if optional.length && canEnquire}<p class="mt-5 text-xs leading-6 text-muted-foreground">Your choices will be included in your enquiry. Availability and any additional charges are confirmed in your customized quotation.</p>{/if}
