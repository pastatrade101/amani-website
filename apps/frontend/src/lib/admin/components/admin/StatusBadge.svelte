<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  export let status = 'draft';
  $: tone = ['available','published','confirmed','completed','replied','approved','active','paid'].includes(status) ? 'positive' : ['limited','pending','new','draft'].includes(status) ? 'pending' : 'neutral';
</script>
<Badge variant="outline" class={`cms-status cms-status-${tone}`}><span class="size-1.5 rounded-full bg-current"></span>{status.replaceAll('_', ' ')}</Badge>
