<script lang="ts">
  import { page } from '$app/stores';
  import BlogPostForm from '$lib/admin/components/admin/BlogPostForm.svelte';

  $: postId = $page.params.id;
</script>

<BlogPostForm mode="edit" {postId} />
