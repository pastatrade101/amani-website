import { animate, hover, inView, stagger, type AnimationPlaybackControlsWithThen } from 'framer-motion/dom';

/** Shared motion language: restrained distance, decisive entrances, gentle settling. */
export const motionTokens = {
	ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
	quick: 0.18,
	standard: 0.55,
	hero: 0.9,
	stagger: 0.085
};

type Registration = { destroy: () => void; finish: () => void; update?: () => void };
const selector = '[data-motion], [data-motion-hover]';

/** One lifecycle for the whole site, including content mounted by shadcn tabs and sheets. */
export function setupSiteMotion(root: HTMLElement = document.body) {
	const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
	const registrations = new Map<HTMLElement, Registration>();
	const animations = new Set<AnimationPlaybackControlsWithThen>();
	const originals = new Map<HTMLElement, { opacity: string; transform: string }>();
	let disposed = false;
	let scanFrame = 0;

	function remember(element: HTMLElement) {
		if (!originals.has(element)) originals.set(element, { opacity: element.style.opacity, transform: element.style.transform });
	}
	function restore(element: HTMLElement) {
		const original = originals.get(element);
		if (original) { element.style.opacity = original.opacity; element.style.transform = original.transform; }
	}
	function track(control: AnimationPlaybackControlsWithThen) {
		animations.add(control);
		void control.then(() => animations.delete(control));
		return control;
	}
	function stop(control?: AnimationPlaybackControlsWithThen) {
		if (!control) return;
		control.stop();
		animations.delete(control);
	}
	function delayFor(element: HTMLElement) {
		const explicit = Number(element.dataset.motionDelay || 0);
		const siblings = element.parentElement ? [...element.parentElement.children].filter((child) => child instanceof HTMLElement && child.dataset.motion === element.dataset.motion) : [];
		return Math.min(0.4, Math.max(0, explicit + Math.max(0, siblings.indexOf(element)) * motionTokens.stagger));
	}
	function register(element: HTMLElement): Registration {
		remember(element);
		const kind = element.dataset.motion;
		const cleanups: Array<() => void> = [];
		const controls: AnimationPlaybackControlsWithThen[] = [];
		let complete = !kind || preference.matches;
		let started = false;
		const words = kind === 'hero-title' ? [...element.querySelectorAll<HTMLElement>('[data-motion-word]')] : [];
		words.forEach(remember);

		function run(...args: Parameters<typeof animate>) {
			const control = track(animate(...args));
			controls.push(control);
			return control;
		}
		function finish() {
			complete = true;
			controls.forEach((control) => control.complete());
			restore(element);
			words.forEach(restore);
			element.dataset.motionState = 'visible';
		}

		// The outgoing image stays below the incoming one during the crossfade.
		if (kind === 'hero-image') {
			let zoom: AnimationPlaybackControlsWithThen | undefined;
			let fade: AnimationPlaybackControlsWithThen | undefined;
			function updateImage() {
				stop(zoom); stop(fade);
				const active = element.dataset.active === 'true';
				if (preference.matches) {
					restore(element);
					element.style.opacity = active ? '1' : '0';
					return;
				}
				fade = track(animate(element, { opacity: active ? 1 : 0 }, { duration: 0.7, ease: motionTokens.ease }));
				if (active) zoom = track(animate(element, { transform: ['scale(1.065)', 'scale(1)'] }, { duration: 9, ease: [0.2, 0.5, 0.3, 1] }));
			}
			cleanups.push(inView(element, () => { updateImage(); return () => { zoom?.pause(); }; }));
			return { update: updateImage, finish: () => { stop(zoom); stop(fade); restore(element); element.style.opacity = element.dataset.active === 'true' ? '1' : '0'; }, destroy: () => { cleanups.forEach((cleanup) => cleanup()); stop(zoom); stop(fade); restore(element); } };
		}

		function reveal() {
			if (complete || started) return;
			started = true;
			element.dataset.motionState = 'running';
			let control: AnimationPlaybackControlsWithThen;
			if (words.length) {
				control = track(animate(words, { opacity: [0, 1], transform: ['translateY(105%) rotate(2deg)', 'translateY(0) rotate(0deg)'] }, { duration: motionTokens.hero, delay: stagger(Math.min(0.06, 0.4 / Math.max(1, words.length - 1)), { startDelay: 0.08 }), ease: motionTokens.ease }));
				controls.push(control);
			} else {
				const image = kind === 'image';
				const line = kind === 'line';
				control = run(element, { opacity: [0, 1], transform: line ? ['scaleX(0)', 'scaleX(1)'] : image ? ['translateY(26px) scale(.97)', 'translateY(0) scale(1)'] : ['translateY(24px)', 'translateY(0)'] }, { duration: kind === 'hero' ? 0.75 : motionTokens.standard, delay: delayFor(element), ease: motionTokens.ease });
			}
			void control.then(() => { if (!disposed && element.isConnected) finish(); });
		}

		if (kind && !preference.matches) {
			const rect = element.getBoundingClientRect();
			// Never conceal text above a restored scroll position or an in-page link.
			if (rect.bottom < 0) finish();
			else {
				element.dataset.motionState = 'pending';
				if (words.length) words.forEach((word) => { word.style.opacity = '0'; word.style.transform = 'translateY(105%)'; });
				else element.style.opacity = '0';
				cleanups.push(inView(element, reveal, { amount: 0.08, margin: '0px 0px -24px 0px' }));
			}
		} else element.dataset.motionState = 'visible';

		if (element.hasAttribute('data-motion-hover')) {
			let interaction: AnimationPlaybackControlsWithThen | undefined;
			function lift() {
				if (preference.matches || !complete || element.matches(':disabled,[aria-disabled="true"]')) return;
				stop(interaction);
				interaction = track(animate(element, { transform: `translateY(${element.dataset.motionHover === 'button' ? -2 : -5}px)` }, { duration: 0.25, ease: motionTokens.ease }));
			}
			function settle() {
				if (preference.matches || !complete) return;
				stop(interaction);
				interaction = track(animate(element, { transform: 'translateY(0px)' }, { duration: 0.3, ease: motionTokens.ease }));
			}
			cleanups.push(hover(element, () => { lift(); return settle; }));
			element.addEventListener('focusin', lift);
			element.addEventListener('focusout', settle);
			cleanups.push(() => { stop(interaction); element.removeEventListener('focusin', lift); element.removeEventListener('focusout', settle); });
		}
		return { finish, destroy: () => { cleanups.forEach((cleanup) => cleanup()); controls.forEach(stop); restore(element); words.forEach(restore); } };
	}

	function scan() {
		scanFrame = 0;
		for (const [element, registration] of registrations) {
			if (!element.isConnected) { registration.destroy(); registrations.delete(element); originals.delete(element); }
		}
		for (const element of originals.keys()) if (!element.isConnected) originals.delete(element);
		root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
			if (!registrations.has(element)) registrations.set(element, register(element));
		});
	}
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) registrations.get(mutation.target)?.update?.();
		});
		if (!scanFrame && mutations.some((mutation) => mutation.type === 'childList')) scanFrame = requestAnimationFrame(scan);
	});
	observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-active'] });
	function onPreferenceChange() {
		document.documentElement.dataset.motion = preference.matches ? 'reduced' : 'ready';
		if (preference.matches) {
			animations.forEach((control) => control.complete());
			registrations.forEach((registration) => registration.finish());
		}
	}
	function onFocus(event: FocusEvent) {
		if (!(event.target instanceof Element)) return;
		let element = event.target.closest<HTMLElement>('[data-motion]');
		while (element) { registrations.get(element)?.finish(); element = element.parentElement?.closest<HTMLElement>('[data-motion]') || null; }
	}
	preference.addEventListener('change', onPreferenceChange);
	root.addEventListener('focusin', onFocus);
	document.documentElement.dataset.motion = preference.matches ? 'reduced' : 'ready';
	scan();
	return () => {
		disposed = true;
		observer.disconnect();
		cancelAnimationFrame(scanFrame);
		preference.removeEventListener('change', onPreferenceChange);
		root.removeEventListener('focusin', onFocus);
		registrations.forEach((registration) => registration.destroy());
		animations.forEach(stop);
		originals.forEach((_, element) => restore(element));
		delete document.documentElement.dataset.motion;
	};
}
