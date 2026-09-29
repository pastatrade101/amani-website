/**
 * Rich text: sanitising, and conversion between HTML and plain text.
 *
 * MIRROR — an identical copy of the sanitiser lives at
 * `backend/src/utils/rich-text.ts`. The backend copy gates what is written to
 * the database; this copy gates what is rendered into the DOM. They are two
 * deliberately independent passes over the same allowlist, so a construct that
 * slipped past one still has to get past the other. Keep the ALLOWED sets in
 * sync: this side being *stricter* silently hides content, this side being
 * *looser* weakens the second gate. The unit tests live with the backend copy.
 *
 * The sanitiser re-serialises from an allowlist rather than stripping bad parts
 * out of the input. Anything the tokeniser does not recognise is dropped and
 * its text escaped, so an unrecognised construct can only ever become inert
 * text — which is what makes the mXSS family (namespace confusion via <svg>,
 * <math>, and friends) a non-event here.
 */

// Tags an editor may produce. Deliberately small: this is body copy, not a page
// builder. No images, tables, iframes or spans — none of which the CMS offers.
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'a',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'blockquote'
]);

const VOID_TAGS = new Set(['br']);

// Blocks cannot sit inside a <p> or a heading; used to auto-close the way a
// browser parser does.
const BLOCK_TAGS = new Set(['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'blockquote']);

// Elements whose *contents* are discarded too, not just their tags. Script and
// style hold raw text that the browser would not re-parse as markup; the rest
// are the classic sanitiser-bypass hosts.
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'template',
  'svg',
  'math',
  'textarea',
  'title'
]);

// Only <a> carries attributes, and only these.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target'])
};

// Enough of the entity table to defeat protocol obfuscation in href
// (`&#106;avascript:`, `javascript&colon;`, `java&Tab;script:`), plus the five
// that appear in ordinary prose.
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  colon: ':',
  tab: '\t',
  newline: '\n',
  sol: '/'
};

const decodeEntities = (value: string): string =>
  value.replace(/&(#x?[0-9a-f]+|[a-z]+);?/gi, (match, body: string) => {
    if (body.charAt(0) === '#') {
      const code =
        body.charAt(1).toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    const named = ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });

/**
 * Escapes text for output. `&` is only escaped when it does not already begin
 * an entity, so `&mdash;` written by an editor survives instead of being
 * mangled into `&amp;mdash;` — and re-sanitising is therefore idempotent.
 */
const escapeText = (value: string): string =>
  value
    .replace(/&(?!#?[a-z0-9]+;)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeAttr = (value: string): string => escapeText(value).replace(/"/g, '&quot;');

/**
 * Escapes an href for output. Unlike escapeAttr this escapes EVERY ampersand,
 * including ones that begin a valid entity.
 *
 * That difference is the whole point: escapeText deliberately preserves
 * `&mdash;` so prose survives, but in an href that same leniency would let
 * `&#106;avascript:` through as literal text for the browser to decode back
 * into `javascript:` — live, after both sanitizer gates had passed it.
 * Escaping every ampersand means nothing in the attribute can re-decode.
 * Query strings still round-trip: `?a=1&b=2` is emitted as `?a=1&amp;b=2`,
 * which is simply the correct encoding of the same URL.
 */
const escapeHref = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Fully decodes entities, repeating until the value stops changing.
 *
 * One pass is not enough: `&amp;#106;avascript:` decodes to
 * `&#106;avascript:`, which no longer looks like a scheme and would sail
 * through the checks below. A value still mutating after several passes is
 * layered encoding no honest URL needs, so it is refused outright.
 */
const fullyDecode = (raw: string): string | null => {
  let current = raw;
  for (let pass = 0; pass < 6; pass += 1) {
    const next = decodeEntities(current);
    if (next === current) return current;
    current = next;
  }
  return null;
};

/**
 * Resolves an href to something safe, or null to drop the link.
 *
 * Control characters are stripped and entities decoded *before* the scheme is
 * tested, which is what closes `java&#09;script:` and `&#106;avascript:`.
 * Anything carrying a scheme that is not http/https/mailto/tel is rejected
 * outright rather than pattern-matched against a blocklist.
 */
const safeHref = (raw: string): string | null => {
  const unwrapped = fullyDecode(raw);
  if (unwrapped === null) return null;

  const decoded = unwrapped
    // C0/C1 controls and non-breaking space, anywhere in the value
    .replace(/[\u0000-\u0020\u007f-\u00a0\u2028\u2029\ufeff]/g, '')
    .trim();

  if (!decoded) return null;
  if (/^(?:https?|mailto|tel):/i.test(decoded)) return decoded;
  // Site-relative, protocol-relative and pure fragments are fine.
  if (/^[/#?]/.test(decoded)) return decoded;
  // Anything else carrying a scheme (javascript:, data:, vbscript:, file:…) goes.
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return null;
  return decoded;
};

type Attr = { name: string; value: string };

const parseAttrs = (source: string): Attr[] => {
  const attrs: Attr[] = [];
  const pattern = /([a-z_:][-a-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    attrs.push({ name: match[1].toLowerCase(), value: match[2] ?? match[3] ?? match[4] ?? '' });
  }

  return attrs;
};

const renderOpenTag = (name: string, attrSource: string): string => {
  const allowed = ALLOWED_ATTRS[name];
  if (!allowed) return `<${name}>`;

  const parts: string[] = [];
  let external = false;

  for (const attr of parseAttrs(attrSource)) {
    if (!allowed.has(attr.name)) continue;

    if (attr.name === 'href') {
      const href = safeHref(attr.value);
      if (!href) return '';
      external = /^(?:https?:)?\/\//i.test(href);
      parts.push(`href="${escapeHref(href)}"`);
      continue;
    }

    if (attr.name === 'target') {
      // Only _blank is meaningful here, and it must not hand the opener over.
      if (attr.value.trim().toLowerCase() === '_blank') parts.push('target="_blank"');
      continue;
    }

    parts.push(`${attr.name}="${escapeAttr(attr.value)}"`);
  }

  // A link with no usable href is not a link.
  if (!parts.some((part) => part.startsWith('href='))) return '';
  // rel is imposed, never taken from the input.
  if (external || parts.includes('target="_blank"')) parts.push('rel="noopener noreferrer"');

  return `<${name} ${parts.join(' ')}>`;
};

/**
 * Sanitises rich-text HTML down to the allowlist above.
 *
 * Plain text passes through unchanged apart from escaping, so a value that was
 * never rich text is safe to run through this too.
 */
export const sanitizeRichText = (input: unknown): string => {
  const html = String(input ?? '');
  if (!html) return '';

  const out: string[] = [];
  const stack: string[] = [];
  let index = 0;

  const closeTo = (name: string) => {
    const at = stack.lastIndexOf(name);
    if (at === -1) return;
    for (let depth = stack.length - 1; depth >= at; depth -= 1) out.push(`</${stack[depth]}>`);
    stack.length = at;
  };

  /**
   * Closes what the markup implies should already be closed, the way a browser
   * parser would: a <p> or heading cannot contain another block, and an <li>
   * cannot contain another <li>. Without this, '<p>one<p>two' would nest rather
   * than sit as siblings, and the closing tags would come out inside out.
   */
  const closeImplied = (name: string) => {
    if (name === 'li') {
      const at = stack.lastIndexOf('li');
      // Not an outer <li> of a nested list — that one stays open.
      if (at !== -1 && !stack.slice(at + 1).some((tag) => tag === 'ul' || tag === 'ol')) closeTo('li');
      return;
    }

    if (!BLOCK_TAGS.has(name)) return;

    for (let depth = stack.length - 1; depth >= 0; depth -= 1) {
      const open = stack[depth];
      // Containers that legitimately hold blocks: stop looking.
      if (open === 'li' || open === 'ul' || open === 'ol' || open === 'blockquote') return;
      if (open === 'p' || open === 'h2' || open === 'h3' || open === 'h4') {
        closeTo(open);
        return;
      }
    }
  };

  while (index < html.length) {
    const lt = html.indexOf('<', index);

    if (lt === -1) {
      out.push(escapeText(html.slice(index)));
      break;
    }

    if (lt > index) out.push(escapeText(html.slice(index, lt)));

    // Comments, doctypes, processing instructions and CDATA: dropped whole.
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      index = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.charAt(lt + 1) === '!' || html.charAt(lt + 1) === '?') {
      const end = html.indexOf('>', lt);
      index = end === -1 ? html.length : end + 1;
      continue;
    }

    const nameMatch = /^<\/?([a-z][a-z0-9]*)/i.exec(html.slice(lt, lt + 24));
    if (!nameMatch) {
      // A bare "<" in prose. Escape it and move on.
      out.push('&lt;');
      index = lt + 1;
      continue;
    }

    // Walk to the closing ">", honouring quoted attribute values so that a ">"
    // inside an attribute does not end the tag early.
    let cursor = lt + 1;
    let quote = '';
    while (cursor < html.length) {
      const char = html.charAt(cursor);
      if (quote) {
        if (char === quote) quote = '';
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        break;
      }
      cursor += 1;
    }
    // An unterminated tag at the end of the input is not markup we can trust.
    if (cursor >= html.length) break;

    const rawTag = html.slice(lt, cursor + 1);
    const name = nameMatch[1].toLowerCase();
    const isClosing = html.charAt(lt + 1) === '/';
    index = cursor + 1;

    if (DROP_WITH_CONTENT.has(name)) {
      if (isClosing) continue;
      // Skip to the matching close tag; if there is none, the rest is forfeit.
      const closer = new RegExp(`</\\s*${name}[^>]*>`, 'i');
      const rest = html.slice(index);
      const found = closer.exec(rest);
      index = found ? index + found.index + found[0].length : html.length;
      continue;
    }

    if (!ALLOWED_TAGS.has(name)) continue;

    if (isClosing) {
      if (!VOID_TAGS.has(name)) closeTo(name);
      continue;
    }

    if (VOID_TAGS.has(name)) {
      out.push(`<${name}>`);
      continue;
    }

    closeImplied(name);

    // Links do not nest, and a nested one usually means malformed input.
    if (name === 'a' && stack.includes('a')) continue;

    const attrSource = rawTag.slice(nameMatch[0].length, -1).replace(/\/$/, '');
    const open = renderOpenTag(name, attrSource);
    if (!open) continue;

    out.push(open);
    stack.push(name);
  }

  while (stack.length) out.push(`</${stack.pop()}>`);

  return (
    out
      .join('')
      // TipTap leaves a trailing empty paragraph behind; spacing is CSS's job.
      .replace(/<p>(?:\s|&nbsp;|<br>)*<\/p>/g, '')
      .trim()
  );
};

/** Does this value carry markup we would render, rather than being plain text? */
export const looksLikeHtml = (value: unknown): boolean =>
  /<(?:p|br|strong|em|u|s|a|ul|ol|li|h[234]|blockquote)\b[^>]*>/i.test(String(value ?? ''));

/**
 * Flattens rich text to plain text, preserving block boundaries as newlines.
 * Plain text in, plain text out — safe to call on either.
 */
export const toPlainText = (value: unknown): string => {
  const raw = String(value ?? '');
  if (!raw) return '';
  if (!looksLikeHtml(raw)) return raw;

  return decodeEntities(
    raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|h[1-6]|li|blockquote|ul|ol)>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Single-line plain text for meta tags, JSON-LD, card teasers and anything else
 * that lands inside an attribute. Truncates on a word boundary.
 */
export const toMetaText = (value: unknown, max = 300): string => {
  const text = toPlainText(value).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;

  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–—-]+$/, '')}…`;
};

/**
 * Is there anything a reader would actually see? `<p></p>` is a truthy string
 * but an empty section — without this, `{#if lodge.description}` would open a
 * heading over nothing.
 */
export const hasRichContent = (value: unknown): boolean => toPlainText(value).trim().length > 0;

/**
 * Plain text to HTML, for content that arrives from somewhere other than the
 * editor — the AI co-pilot, CSV imports, and everything written before this
 * feature existed. Blank lines become paragraphs, single newlines become line
 * breaks, and dash/number-prefixed runs of lines become real lists.
 */
export const plainToHtml = (value: unknown): string => {
  const text = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!text) return '';
  if (looksLikeHtml(text)) return sanitizeRichText(text);

  const bulletOf = /^\s*[-*•]\s+/;
  const numberOf = /^\s*\d+[.)]\s+/;

  const blocks = text.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n').filter((line) => line.trim());
    if (!lines.length) return '';

    if (lines.every((line) => bulletOf.test(line))) {
      return `<ul>${lines.map((line) => `<li>${escapeText(line.replace(bulletOf, '').trim())}</li>`).join('')}</ul>`;
    }

    if (lines.every((line) => numberOf.test(line))) {
      return `<ol>${lines.map((line) => `<li>${escapeText(line.replace(numberOf, '').trim())}</li>`).join('')}</ol>`;
    }

    return `<p>${lines.map((line) => escapeText(line.trim())).join('<br>')}</p>`;
  });

  return blocks.filter(Boolean).join('');
};
