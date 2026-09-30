/**
 * CMS rich text reaches the public tour page through {@html}. The API already
 * sanitises it; this is a second, deliberately small allow-list that needs no
 * DOM (it runs during SSR and in the browser), so a stray tag can neither run
 * script nor break the page layout.
 *
 * Kept: p, br, strong, em, ul, ol, li, and a[href] for http(s)/mailto links.
 * b/i become strong/em, headings become bold paragraphs and other block tags
 * become paragraphs. Every other tag is dropped but its text kept, except
 * script-like tags, which are dropped with their content.
 */
const ALLOWED = new Set(['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a']);
const RENAMED: Record<string, string> = { b: 'strong', i: 'em' };
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const BLOCKS = new Set(['div', 'blockquote', 'section', 'article', 'header', 'footer', 'aside', 'figure', 'figcaption', 'pre', 'address', 'details', 'summary', 'table', 'tr', 'dl', 'dt', 'dd']);
const DROPPED_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'noembed', 'template', 'svg', 'math', 'textarea', 'select', 'option', 'title', 'head', 'frame', 'frameset', 'xmp', 'plaintext', 'canvas', 'video', 'audio']);
const LISTS = new Set(['ul', 'ol']);

// Comments, doctypes/processing instructions, then real tags (quoted attribute values may hold ">").
const TOKEN = /<!--[\s\S]*?(?:-->|$)|<[!?][^>]*>?|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

const escapeText = (text: string) =>
	text
		.replace(/&(?![a-zA-Z][a-zA-Z0-9]{1,31};|#\d{1,7};|#x[0-9a-fA-F]{1,6};)/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', tab: '\t', newline: '\n', sol: '/', lpar: '(', rpar: ')' };

/** Decodes the entities an attacker could use to hide "javascript:" in an href. */
function decodeEntities(value: string) {
	return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (match, entity: string) => {
		if (entity[0] === '#') {
			const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
			return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
		}
		return NAMED[entity.toLowerCase()] ?? match;
	});
}

/** A link target the page may render, or '' when the href is missing or unsafe. */
export function safeHref(attributes: string): string {
	const found = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attributes);
	if (!found) return '';
	// Browsers ignore whitespace and control characters inside URLs, so strip them before checking the scheme.
	const href = decodeEntities(found[1] ?? found[2] ?? found[3] ?? '').replace(/[\u0000- \u007f-\u009f]+/g, '');
	return /^(?:https?:\/\/[^/\\]|mailto:[^/\\])/i.test(href) ? href : '';
}

/** Plain text (older days were typed without markup): blank lines are paragraphs, single newlines are line breaks. */
function plainTextToHtml(text: string) {
	return text
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.map((paragraph) => `<p>${escapeText(paragraph).replace(/\s*\n\s*/g, '<br>')}</p>`)
		.join('');
}

export function sanitizeRichText(input?: string | null): string {
	const source = (input ?? '').replace(/\r\n?/g, '\n').trim();
	if (!source) return '';
	if (!/<[a-zA-Z!/?]/.test(source)) return plainTextToHtml(source);

	const out: string[] = [];
	const stack: string[] = [];
	const lastIndex = (names: Set<string> | string) => {
		for (let i = stack.length - 1; i >= 0; i -= 1) if (typeof names === 'string' ? stack[i] === names : names.has(stack[i])) return i;
		return -1;
	};
	const closeTo = (index: number) => {
		while (stack.length > index) out.push(`</${stack.pop()}>`);
	};
	// Like a browser: a new block closes an open paragraph unless a list sits between them.
	const closeParagraph = () => {
		const p = lastIndex('p');
		if (p > lastIndex(new Set(['ul', 'ol', 'li']))) closeTo(p);
	};
	const open = (tag: string, markup = `<${tag}>`) => {
		out.push(markup);
		stack.push(tag);
	};

	TOKEN.lastIndex = 0;
	let cursor = 0;
	for (let match = TOKEN.exec(source); match; match = TOKEN.exec(source)) {
		out.push(escapeText(source.slice(cursor, match.index)));
		cursor = TOKEN.lastIndex;
		const [, slash, rawName, attributes = ''] = match;
		if (!rawName) continue; // comment, doctype or processing instruction
		const name = rawName.toLowerCase();
		const closing = slash === '/';

		if (DROPPED_WITH_CONTENT.has(name)) {
			if (closing || /\/\s*$/.test(attributes)) continue;
			const end = new RegExp(`</${name}\\s*>`, 'ig');
			end.lastIndex = cursor;
			const found = end.exec(source);
			cursor = found ? end.lastIndex : source.length;
			TOKEN.lastIndex = cursor;
			continue;
		}

		const tag = RENAMED[name] ?? name;
		if (HEADINGS.has(tag) || BLOCKS.has(tag)) {
			closeParagraph();
			if (!closing) {
				open('p');
				if (HEADINGS.has(tag)) open('strong');
			}
			continue;
		}
		if (!ALLOWED.has(tag)) continue;

		if (closing) {
			const index = tag === 'br' ? -1 : lastIndex(tag);
			if (index >= 0) closeTo(index);
			continue;
		}
		if (tag === 'br') {
			out.push('<br>');
			continue;
		}
		if (tag === 'p' || LISTS.has(tag)) closeParagraph();
		if (tag === 'li') {
			const li = lastIndex('li');
			if (li > lastIndex(LISTS)) closeTo(li);
		}
		if (tag === 'a') {
			const a = lastIndex('a');
			if (a >= 0) closeTo(a);
			const href = safeHref(attributes);
			// A link without a safe target keeps its text and loses the link.
			if (href) open('a', `<a href="${escapeAttribute(href)}" rel="noopener">`);
			continue;
		}
		open(tag);
	}
	out.push(escapeText(source.slice(cursor)));
	closeTo(0);
	return out.join('').replace(/<p>(?:\s|<br>)*<\/p>/g, '').trim();
}
