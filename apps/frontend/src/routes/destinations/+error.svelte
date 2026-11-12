<script lang="ts">
import { page } from '$app/state';
import { Button } from '$lib/components/ui/button';
</script>
<svelte:head><title>Destination unavailable | Key2africa Safaris</title><meta name="robots" content="noindex"/></svelte:head>
<main class="grid min-h-screen place-items-center bg-secondary px-6"><div class="max-w-xl text-center"><h1 class="text-4xl font-semibold tracking-tight">{page.status===404?'We can’t find that destination':'This destination won’t load right now'}</h1><p class="my-6 text-sm leading-7 text-muted-foreground">{page.error?.message}</p><Button href="/destinations" variant="safari">Explore destinations</Button><a href="/" class="mt-5 block text-sm">Back to home</a></div></main>
