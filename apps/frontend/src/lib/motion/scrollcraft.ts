/**
 * Mounts the ScrollCraft engine (src/lib/vendor/scrollcraft.js) on a section
 * while a media query holds, and takes it down cleanly when it stops holding
 * or the section leaves the page.
 *
 * The markup carries the engine's own data-sc-* attributes at every size; they
 * do nothing until the engine is mounted. While it runs the node carries
 * `data-sc-live`, so CSS can switch to the scroll-driven layout only then. The
 * engine is loaded on first use, so phones and reduced-motion visitors never
 * download it.
 */
type Engine = { destroy(): void; layout(): void; read(): void };
type Options = { query?: string; onChange?: (live: boolean) => void };

declare global {
	interface Window {
		ScrollCraft?: { mount(root: Element, opts?: Record<string, unknown>): Engine };
	}
}

export const SCROLL_STORY = '(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)';

export function scrollcraft(node: HTMLElement, options: Options = {}) {
	const mq = matchMedia(options.query ?? SCROLL_STORY);
	let engine: Engine | null = null;
	let gone = false;
	// Content above the section (images, carousels, fonts) can still change
	// height after mount, which moves where the act starts. Re-measure then.
	const resize = new ResizeObserver(() => engine?.layout());

	async function sync() {
		if (mq.matches && !engine) {
			if (!window.ScrollCraft) await import('$lib/vendor/scrollcraft.js');
			if (gone || !mq.matches || engine || !window.ScrollCraft) return;
			node.setAttribute('data-sc-live', '');
			engine = window.ScrollCraft.mount(node);
			resize.observe(document.body);
			options.onChange?.(true);
		} else if (!mq.matches && engine) stop();
	}

	function stop() {
		engine?.destroy();
		engine = null;
		resize.disconnect();
		node.removeAttribute('data-sc-live');
		// The engine writes inline heights, opacities, transforms and clip paths;
		// the static layout needs none of them.
		for (const element of node.querySelectorAll<HTMLElement>('[data-sc-act], [data-sc-stage], [data-sc-cue], [data-sc-parallax], [data-sc-reveal]')) {
			element.removeAttribute('style');
			element.classList.remove('sc-stage', 'sc-act--pinned');
		}
		options.onChange?.(false);
	}

	mq.addEventListener('change', sync);
	sync();

	return {
		destroy() {
			gone = true;
			mq.removeEventListener('change', sync);
			stop();
		}
	};
}
