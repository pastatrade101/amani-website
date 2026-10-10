<script lang="ts">
 import { createEventDispatcher } from 'svelte';
 import { api } from '$lib/admin/api/client';
 import type { TourPriceOption } from '$lib/admin/types';
 import { Button } from '$lib/components/ui/button';
 import AdminFormInput from '../AdminFormInput.svelte';
 import AdminSelect from '../AdminSelect.svelte';
 export let tourId = '';
 export let activityName: string;
 export let rate: TourPriceOption | null = null;
 const dispatch = createEventDispatcher<{saved:TourPriceOption}>();
 let expanded=false, saving=false, error='', amount='', currency='USD', charge='per_person';
 const start=() => { amount=rate ? String(rate.price) : ''; currency=rate?.currency || 'USD'; charge=rate?.price_type || 'per_person'; expanded=true; error=''; };
 const save=async () => {
  if (!tourId || !amount.trim() || !Number.isFinite(Number(amount)) || Number(amount)<0 || !/^[A-Z]{3}$/.test(currency.toUpperCase())) {error='Enter a valid amount and a three-letter currency.';return;}
  saving=true;error='';
  try { const body={tour_id:tourId,title:rate?.title || activityName,price:Number(amount),currency:currency.toUpperCase(),price_type:charge,is_addon:true}; const response=rate ? await api.pricingOptions.update(rate.id,body) : await api.pricingOptions.create(body); dispatch('saved',response.data as unknown as TourPriceOption); expanded=false; }
  catch {error='Unable to save this rate. Check your pricing permissions and try again.';} finally {saving=false;}
 };
</script>
<div class="mt-3">
 {#if !tourId}<p class="text-xs text-ink/55">Save this tour first to create an additional-cost rate.</p>
 {:else if !expanded}<Button type="button" variant="outline" size="sm" onclick={start}>{rate ? 'Edit additional-cost rate' : 'Create additional-cost rate'}</Button>
 {:else}<div class="grid gap-3 rounded-xl border border-ink/10 bg-surface p-3 sm:grid-cols-3">
 <AdminFormInput label="Amount" name={`rate-amount-${activityName}`} bind:value={amount} />
 <AdminFormInput label="Currency" name={`rate-currency-${activityName}`} bind:value={currency} />
 <AdminSelect label="Charge basis" name={`rate-charge-${activityName}`} bind:value={charge} options={[{value:'per_person',label:'Per person'},{value:'per_group',label:'Per group'},{value:'per_child',label:'Per child'}]} />
 <p class="text-xs text-ink/55 sm:col-span-3">The rate is saved in Pricing Options. Save the tour to apply the activity selection.</p>
 {#if error}<p role="alert" class="text-xs text-red-700 sm:col-span-3">{error}</p>{/if}
 <div class="flex gap-2 sm:col-span-3"><Button type="button" size="sm" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save rate'}</Button><Button type="button" variant="ghost" size="sm" onclick={() => expanded=false}>Cancel</Button></div>
 </div>{/if}
</div>
