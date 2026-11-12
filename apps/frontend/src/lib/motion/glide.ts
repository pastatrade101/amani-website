/**
 * `use:glide` gives any tab-like group one marker that slides to the active
 * item instead of each item switching its own background on and off.
 *
 * The active item is whichever descendant matches `selector` (by default the
 * usual ARIA states). The marker sits behind the items, sized to the active one
 * (or to a part of it, e.g. `[aria-current="page"] .tab-icon`), and glides with
 * an ease-out when the state moves. Style it per component with
 * `:global(.glide-mark)`; give the active item a transparent background.
 * The motion itself lives in layout.css (`.glide-mark`), reduced-motion aware.
 */
type Options = { selector?: string; name?: string };

const ACTIVE = '[aria-current="true"], [aria-current="page"], [aria-selected="true"], [aria-pressed="true"], [data-state="active"], [data-state="on"]';

export function glide(node: HTMLElement, options: Options = {}) {
	const mark = document.createElement('span');
	mark.className = 'glide-mark';
	mark.setAttribute('aria-hidden', 'true');
	// A view transition name lets the marker slide across page changes too.
	if (options.name) mark.style.setProperty('view-transition-name', options.name);
	node.classList.add('glide');
	node.prepend(mark);

	let frame = 0;
	function place() {
		const item = node.querySelector<HTMLElement>(options.selector ?? ACTIVE);
		if (!item) {
			mark.style.opacity = '0';
			return;
		}
		const box = node.getBoundingClientRect();
		const it = item.getBoundingClientRect();
		const x = it.left - box.left - node.clientLeft + node.scrollLeft;
		const y = it.top - box.top - node.clientTop + node.scrollTop;
		mark.style.width = `${it.width}px`;
		mark.style.height = `${it.height}px`;
		mark.style.transform = `translate3d(${x}px, ${y}px, 0)`;
		mark.style.opacity = '1';
	}
	const schedule = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(place);
	};

	const changes = new MutationObserver(schedule);
	changes.observe(node, { subtree: true, attributes: true, attributeFilter: ['aria-current', 'aria-selected', 'aria-pressed', 'data-state'] });
	const sizes = new ResizeObserver(schedule);
	sizes.observe(node);
	for (const child of node.children) if (child !== mark) sizes.observe(child);

	// The first placement lands without motion; only later moves glide.
	place();
	const ready = requestAnimationFrame(() => node.classList.add('glide-ready'));
	document.fonts?.ready.then(schedule);

	return {
		update(next: Options) {
			options = next;
			schedule();
		},
		destroy() {
			cancelAnimationFrame(frame);
			cancelAnimationFrame(ready);
			changes.disconnect();
			sizes.disconnect();
			mark.remove();
			node.classList.remove('glide', 'glide-ready');
		}
	};
}
