<script lang="ts">
  import { onMount } from 'svelte';
  import RichText from './RichText.svelte';

  type FAQItem = { id?: string; question: string; answer: string };

  export let faqs: FAQItem[] = [];

  let root: HTMLElement;
  let activeIndex = 0;

  onMount(() => {
    let nearViewport = false;
    let frame = 0;

    const compute = () => {
      frame = 0;
      if (!root) return;
      const threshold = window.innerHeight * 0.45;
      const items = root.querySelectorAll<HTMLElement>('[data-faq-item]');
      let reached = -1;
      items.forEach((item, index) => {
        if (item.getBoundingClientRect().top <= threshold) reached = index;
      });
      activeIndex = Math.max(0, reached);
    };

    const queueCompute = () => {
      if (!nearViewport || frame) return;
      frame = requestAnimationFrame(compute);
    };

    const proximityObserver = new IntersectionObserver(
      ([entry]) => {
        nearViewport = Boolean(entry?.isIntersecting);
        if (nearViewport) queueCompute();
      },
      { rootMargin: '100% 0px' }
    );

    proximityObserver.observe(root);
    window.addEventListener('scroll', queueCompute, { passive: true });
    window.addEventListener('resize', queueCompute);
    return () => {
      proximityObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', queueCompute);
      window.removeEventListener('resize', queueCompute);
    };
  });
</script>

<ol class="faq-timeline relative" bind:this={root}>
  {#each faqs as faq, index (faq.id ?? `${faq.question}-${index}`)}
    {@const state = index === activeIndex ? 'is-active' : index < activeIndex ? 'is-complete' : 'is-upcoming'}
    <li data-faq-item class={`faq-item ${state} relative pb-10 pl-14 last:pb-0 md:pb-12 md:pl-20`}>
      {#if index < faqs.length - 1}
        <span class="faq-connector pointer-events-none absolute left-4 top-10 bottom-0 w-px md:left-5" aria-hidden="true"></span>
      {/if}
      <span class="faq-number absolute left-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-full font-serif text-[13px] font-semibold md:h-10 md:w-10 md:text-[15px]" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      <h3 class="font-serif text-[18px] font-semibold leading-snug text-heading md:text-[21px]">{faq.question}</h3>
      <RichText value={faq.answer} className="mt-3 text-[15px] leading-7 text-ink/75 md:text-base md:leading-7" />
    </li>
  {/each}
</ol>

<style>
  .faq-number {
    border: 1px solid rgb(var(--c-ink) / 0.2);
    background: rgb(var(--c-surface));
    color: rgb(var(--c-heading));
    transition: color 180ms ease, background-color 180ms ease, border-color 180ms ease;
  }

  .faq-connector {
    overflow: hidden;
    background: rgb(var(--c-ink) / 0.18);
  }

  .faq-connector::before {
    position: absolute;
    inset: 0;
    content: '';
    background: rgb(var(--c-clay));
    transform: scaleY(0);
    transform-origin: top;
    transition: transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .faq-item.is-complete .faq-number,
  .faq-item.is-active .faq-number {
    border-color: rgb(var(--c-clay));
    background: rgb(var(--c-clay));
    color: white;
  }

  .faq-item.is-complete .faq-connector::before { transform: scaleY(1); }
  .faq-item.is-active .faq-connector::before { transform: scaleY(0.45); }

  .faq-item.is-active .faq-number {
    box-shadow: 0 0 0 3px rgb(var(--c-clay) / 0.08);
  }

  .faq-item { min-width:0; overflow-wrap:anywhere; }
  .faq-item h3 { text-wrap:pretty; }

  @media (prefers-reduced-motion: reduce) {
    .faq-number, .faq-connector::before, .faq-item { animation: none; transition: none; }
  }
</style>
