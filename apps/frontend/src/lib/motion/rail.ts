/**
 * `use:rail` turns a horizontal scroll row into an app-style card rail.
 *
 * Every frame the row moves, each card gets two CSS custom properties:
 *   --rail      its signed distance from the row's centre, in card steps
 *               (-1 = one card to the left, 0 = centred, 1 = one to the right)
 *   --rail-abs  the same distance without the sign, capped at 1
 * so CSS can scale, dim or shift a card (or the photo inside it) in step with
 * the finger instead of switching classes. `onIndex` reports the centred card.
 *
 * `steer(row, i)` scrolls card i to the centre. While it travels, the cards it
 * passes are not reported, so a tab bar watching `onIndex` does not flicker
 * through them; touching the row hands control back at once.
 */
type Options = { onIndex?: (index: number) => void };

const steering = new WeakMap<HTMLElement, number>();

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function steer(row: HTMLElement | undefined, index: number) {
	const card = row?.children[index] as HTMLElement | undefined;
	if (!row || !card) return;
	const box = card.getBoundingClientRect(), frame = row.getBoundingClientRect();
	const left = row.scrollLeft + box.left + box.width / 2 - (frame.left + row.clientWidth / 2);
	const max = row.scrollWidth - row.clientWidth;
	if (Math.abs(Math.max(0, Math.min(max, left)) - row.scrollLeft) < 2) return;
	steering.set(row, index);
	row.scrollTo({ left, behavior: reduced() ? 'instant' : 'smooth' });
}

export function rail(node: HTMLElement, options: Options = {}) {
	let frame = 0;
	let last = -1;

	function measure() {
		frame = 0;
		const cards = [...node.children] as HTMLElement[];
		if (!cards.length) return;
		const centre = node.getBoundingClientRect().left + node.clientWidth / 2;
		const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : cards[0].offsetWidth || 1;
		let nearest = 0, best = Infinity;
		cards.forEach((card, i) => {
			const box = card.getBoundingClientRect();
			const offset = (box.left + box.width / 2 - centre) / (step || 1);
			const distance = Math.abs(offset);
			if (distance < best) (best = distance), (nearest = i);
			card.style.setProperty('--rail', Math.max(-1.5, Math.min(1.5, offset)).toFixed(4));
			card.style.setProperty('--rail-abs', Math.min(1, distance).toFixed(4));
		});
		const target = steering.get(node);
		if (target !== undefined) {
			if (nearest !== target || best > 0.02) return;
			steering.delete(node);
		}
		if (nearest !== last) {
			last = nearest;
			options.onIndex?.(nearest);
		}
	}
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(measure);
	};
	const release = () => steering.delete(node);

	node.addEventListener('scroll', schedule, { passive: true });
	const ended = () => {
		steering.delete(node);
		schedule();
	};
	node.addEventListener('scrollend', ended);
	node.addEventListener('pointerdown', release, { passive: true });
	node.addEventListener('wheel', release, { passive: true });
	const sizes = new ResizeObserver(schedule);
	sizes.observe(node);
	const changes = new MutationObserver(schedule);
	changes.observe(node, { childList: true });
	schedule();

	return {
		update(next: Options) {
			options = next;
		},
		destroy() {
			cancelAnimationFrame(frame);
			sizes.disconnect();
			changes.disconnect();
			node.removeEventListener('scroll', schedule);
			node.removeEventListener('scrollend', ended);
			node.removeEventListener('pointerdown', release);
			node.removeEventListener('wheel', release);
			for (const card of node.children as HTMLCollectionOf<HTMLElement>) {
				card.style.removeProperty('--rail');
				card.style.removeProperty('--rail-abs');
			}
		}
	};
}
