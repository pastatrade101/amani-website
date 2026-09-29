<script lang="ts">
  export let className = '';
</script>

<div class={`cms-toolbar w-full min-w-0 max-w-full ${className}`}>
  <slot />
</div>
