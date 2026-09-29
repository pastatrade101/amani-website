<script lang="ts">
  import { page } from '$app/stores';
  import TourForm from '$lib/admin/components/admin/TourForm.svelte';

  $: tourId = $page.params.id;
</script>

<TourForm mode="edit" {tourId} />
