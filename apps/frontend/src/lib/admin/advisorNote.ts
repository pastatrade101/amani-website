/**
 * The Advisor's Note, resolved once for every page that shows it.
 *
 * It appeared three different ways: the homepage card driven by the CMS, the
 * same card on the tours listing with its heading and columns hardcoded, and a
 * different layout entirely on a safari-style page reading per-category text.
 * A visitor who saw two of them saw two different companies making two
 * different promises.
 *
 * There is one section now, and this is where its content comes from — the
 * `advisor_note` homepage section, so an editor changes it in one place and
 * every page follows.
 *
 * Only keys the CMS actually fills are returned. Everything else is left off so
 * the component's own defaults apply, rather than being restated here where the
 * two copies would drift.
 */
/** One of the two lists beside the note. The component renders at most two. */
export type AdvisorColumn = { icon_url?: string; title: string; items: string[] };

/** The shape of a homepage section record, as every page already holds it. */
export type AdvisorNoteSection = {
  title?: string | null;
  subtitle?: string | null;
  image_url?: string | null;
  is_active?: boolean;
  extra_data?: Record<string, unknown> | null;
};

const text = (value: unknown): string | undefined => {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  return cleaned || undefined;
};

/** Columns survive only if they carry a title and at least one real line. */
const columnsFrom = (value: unknown): AdvisorColumn[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const columns = value
    .map((entry) => {
      const column = (entry ?? {}) as Record<string, unknown>;
      return {
        icon_url: text(column.icon_url),
        title: text(column.title) ?? '',
        items: (Array.isArray(column.items) ? column.items : []).map((item) => String(item ?? '').trim()).filter(Boolean)
      };
    })
    .filter((column) => column.title && column.items.length);
  return columns.length ? columns : undefined;
};

export type AdvisorNoteProps = {
  eyebrow?: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  authorName?: string;
  authorRole?: string;
  footnote?: string;
  columns?: AdvisorColumn[];
};

/**
 * `sections` is the homepage sections keyed by `section_key`, which every page
 * showing this already loads.
 */
export const advisorNoteProps = (
  sections: Record<string, AdvisorNoteSection | undefined> | null | undefined
): AdvisorNoteProps => {
  const section = sections?.advisor_note;
  const extra = (section?.extra_data ?? {}) as Record<string, unknown>;

  const props: AdvisorNoteProps = {
    eyebrow: text(extra.eyebrow),
    title: text(section?.title),
    body: text(section?.subtitle),
    imageUrl: text(section?.image_url),
    authorName: text(extra.author_name),
    authorRole: text(extra.author_role),
    footnote: text(extra.footnote),
    columns: columnsFrom(extra.columns)
  };

  /**
   * Once the section exists, the CMS is the whole truth — a field cleared in
   * the admin renders as cleared.
   *
   * Every key used to be dropped when empty, which handed the field back to the
   * component's own default. That made the copy overridable but not erasable:
   * deleting the footnote in the CMS put the original footnote back on four
   * pages, with nothing to explain why.
   *
   * When the section is ABSENT — the homepage fetch failed, or it was never
   * created — nothing is returned and the component's defaults still stand in,
   * so a transient error shows the note rather than an empty card.
   */
  if (!section) return {};

  return {
    ...props,
    eyebrow: props.eyebrow ?? '',
    title: props.title ?? '',
    body: props.body ?? '',
    authorName: props.authorName ?? '',
    authorRole: props.authorRole ?? '',
    footnote: props.footnote ?? '',
    columns: props.columns ?? [],
    // The portrait is the one exception: the component falls back to initials
    // in a ring, which is a designed empty state rather than a hole.
    ...(props.imageUrl === undefined ? {} : { imageUrl: props.imageUrl })
  };
};

/**
 * One page's own note, written over the site-wide one.
 *
 * A safari-package page can carry an `advisor` block. The block holds only what
 * that page says differently; every field it leaves empty falls through to the
 * shared note. Two things follow from that, and both are the point: a page that
 * wants one different paragraph writes one paragraph rather than retyping the
 * advisor, the portrait and both lists — and when the shared note is edited,
 * the parts a page did not override change with it.
 *
 * The trade is that a block cannot blank a field the shared note fills. Erasing
 * is what the shared note is for; a block is for saying something else.
 */
export const advisorNoteFromBlock = (
  block: Record<string, unknown> | null | undefined,
  sections: Record<string, AdvisorNoteSection | undefined> | null | undefined
): AdvisorNoteProps => {
  const base = advisorNoteProps(sections);
  const own = (block ?? {}) as Record<string, unknown>;

  /**
   * Safari Styles stored their per-category version before the shared card
   * existed. Keep that compact document useful by reading its old names as
   * aliases for the shared component's fields. This lets every style have its
   * own note without making editors duplicate the site-wide portrait and
   * advisor details.
   */
  const legacyColumns = (): AdvisorColumn[] | undefined => {
    const columns = [
      { title: 'The big decisions', items: own.big },
      { title: 'The quiet details', items: own.quiet }
    ]
      .map((column) => ({
        title: column.title,
        items: (Array.isArray(column.items) ? column.items : []).map((item) => String(item ?? '').trim()).filter(Boolean)
      }))
      .filter((column) => column.items.length);
    return columns.length ? columns : undefined;
  };

  /*
   * `??`, not `||`: the shared note returns '' for a field an editor cleared,
   * and a cleared field is an answer. Falling back on '' would put the
   * component's hardcoded default back on the page, which is the drift this
   * module exists to prevent.
   */
  return {
    eyebrow: text(own.eyebrow) ?? base.eyebrow,
    title: text(own.title) ?? text(own.headline) ?? base.title,
    body: text(own.body) ?? text(own.intro) ?? base.body,
    imageUrl: text(own.image_url) ?? base.imageUrl,
    authorName: text(own.author_name) ?? base.authorName,
    authorRole: text(own.author_role) ?? base.authorRole,
    footnote: text(own.footnote) ?? base.footnote,
    columns: columnsFrom(own.columns) ?? legacyColumns() ?? base.columns
  };
};

/** The homepage switch still governs it: off there means off everywhere. */
export const advisorNoteEnabled = (
  sections: Record<string, AdvisorNoteSection | undefined> | null | undefined
): boolean => sections?.advisor_note?.is_active !== false;
