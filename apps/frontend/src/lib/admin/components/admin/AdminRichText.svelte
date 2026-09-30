<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';

  /**
   * Rich-text field for long-form CMS content — the editor counterpart to
   * <RichText> on the public site.
   *
   * Deliberately shaped like an email composer: one row of familiar controls,
   * no page-builder chrome, and nothing in the toolbar that the sanitizer would
   * throw away on save. Anything typed here survives a round trip because the
   * editor's schema and `sanitizeRichText`'s allowlist describe the same set of
   * tags.
   *
   * Plain text already in the database is converted on the way in, so an
   * existing description opens as real paragraphs rather than one long line.
   */
  import { onDestroy, onMount } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Link from '@tiptap/extension-link';
  import Underline from '@tiptap/extension-underline';
  import Placeholder from '@tiptap/extension-placeholder';
  import {
    Bold,
    Eraser,
    Italic,
    Link2,
    Link2Off,
    List,
    ListOrdered,
    Quote,
    Redo2,
    Underline as UnderlineIcon,
    Undo2
  } from '@lucide/svelte';
  import { hasRichContent, looksLikeHtml, plainToHtml, sanitizeRichText } from '$lib/admin/richText';
  import { richTextLength } from '$lib/tour-limits';

  export let label: string;
  export let name: string;
  export let value = '';
  export let placeholder = '';
  /** Roughly the same knob as AdminTextArea's `rows`. */
  export let rows = 8;
  /** Body copy sits under the page's own headings, so H2 is off by default. */
  export let headings: 'none' | 'h3' | 'h2h3' = 'h3';
  export let hint = '';
  /** Content-only toolbar for template-managed package sections. */
  export let compact = false;
  /**
   * Characters of text the field may hold (markup does not count). Shows a
   * live counter; a contenteditable has no `maxlength`, so the form's own
   * save check is what stops a longer text.
   */
  export let maxChars: number | undefined = undefined;

  $: textLength = maxChars ? richTextLength(value) : 0;
  $: overBy = maxChars ? textLength - maxChars : 0;

  let element: HTMLDivElement;
  let editor: Editor | null = null;
  // Mirrors the editor's own state so the toolbar can show what is active.
  let state = {
    bold: false,
    italic: false,
    underline: false,
    bulletList: false,
    orderedList: false,
    blockquote: false,
    h2: false,
    h3: false,
    link: false,
    canUndo: false,
    canRedo: false
  };

  // What the field last pushed out, so echoes of our own change do not reset
  // the cursor when the parent writes `value` straight back.
  let lastEmitted = '';

  const headingLevels = headings === 'none' ? [] : headings === 'h2h3' ? [2, 3] : [3];

  const syncState = () => {
    if (!editor) return;
    state = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      blockquote: editor.isActive('blockquote'),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      link: editor.isActive('link'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo()
    };
  };

  const emit = () => {
    if (!editor) return;
    const html = editor.getHTML();
    // An empty document is an empty field, not "<p></p>" — otherwise every
    // `{#if description}` on the public site would open a section over nothing.
    const next = hasRichContent(html) ? sanitizeRichText(html) : '';
    lastEmitted = next;
    value = next;
  };

  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit.configure({
          heading: headingLevels.length ? { levels: headingLevels as (2 | 3)[] } : false,
          // Nothing here survives the sanitizer, so nothing here is offered.
          codeBlock: false,
          code: false,
          horizontalRule: false,
          strike: false
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          // Matches the sanitizer's href allowlist exactly.
          protocols: ['http', 'https', 'mailto', 'tel'],
          HTMLAttributes: { rel: 'noopener noreferrer' }
        }),
        Placeholder.configure({ placeholder: placeholder || 'Write here…' })
      ],
      // Existing plain-text content becomes real paragraphs on first open.
      content: looksLikeHtml(value) ? sanitizeRichText(value) : plainToHtml(value),
      editorProps: {
        attributes: {
          class: 'admin-rich-surface',
          'aria-label': label
        }
      },
      onUpdate: () => {
        emit();
        syncState();
      },
      onSelectionUpdate: syncState,
      onTransaction: syncState
    });

    // The editor was just built from `value`, so the two are already in step.
    lastEmitted = value;
    syncState();
  });

  onDestroy(() => {
    editor?.destroy();
    editor = null;
  });

  // The parent may load the record after the editor mounts (every admin page
  // fetches in onMount). Push that in — but never echo our own output back,
  // which would reset the caret mid-typing.
  $: if (editor && value !== lastEmitted) {
    const incoming = looksLikeHtml(value) ? sanitizeRichText(value) : plainToHtml(value);
    if (incoming !== editor.getHTML()) {
      // addToHistory:false keeps this swap off the undo stack. Without it, Undo
      // walks back past the record that is currently open — into the previous
      // record's text, or into the empty document from before the fetch — and
      // the resulting update emits that stale content back into `value`.
      editor.chain().setContent(incoming, false).setMeta('addToHistory', false).run();
    }
    // Tracked whether or not the content actually had to change: when the
    // editor was constructed from a populated value the two already agree, and
    // leaving lastEmitted at '' would make a later genuine reset to '' look
    // like a no-op and silently skip clearing the field.
    lastEmitted = value;
    syncState();
  }

  const toggleLink = () => {
    if (!editor) return;

    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const previous = String(editor.getAttributes('link').href ?? '');
    const input = window.prompt('Link address (https://…, mailto:…, or /a-page)', previous);
    if (input === null) return;

    const href = input.trim();
    if (!href) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    // A bare domain is almost always meant as a link, not a relative path.
    const normalised = /^(?:https?:|mailto:|tel:|[/#])/i.test(href) ? href : `https://${href}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: normalised }).run();
  };

  const clearFormatting = () => {
    editor?.chain().focus().unsetAllMarks().clearNodes().run();
  };

  type Control = {
    action: () => void;
    active?: boolean;
    disabled?: boolean;
    icon?: typeof Bold;
    label: string;
    text?: string;
  };

  $: groups = (editor
    ? [
        [
          { label: 'Bold', icon: Bold, active: state.bold, action: () => editor?.chain().focus().toggleBold().run() },
          { label: 'Italic', icon: Italic, active: state.italic, action: () => editor?.chain().focus().toggleItalic().run() },
          {
            label: 'Underline',
            icon: UnderlineIcon,
            active: state.underline,
            action: () => editor?.chain().focus().toggleUnderline().run()
          }
        ],
        [
          {
            label: 'Bulleted list',
            icon: List,
            active: state.bulletList,
            action: () => editor?.chain().focus().toggleBulletList().run()
          },
          {
            label: 'Numbered list',
            icon: ListOrdered,
            active: state.orderedList,
            action: () => editor?.chain().focus().toggleOrderedList().run()
          },
          {
            label: 'Quote',
            icon: Quote,
            active: state.blockquote,
            action: () => editor?.chain().focus().toggleBlockquote().run()
          }
        ],
        headingLevels.map((level) => ({
          label: `Heading ${level}`,
          text: `H${level}`,
          active: level === 2 ? state.h2 : state.h3,
          action: () =>
            editor
              ?.chain()
              .focus()
              .toggleHeading({ level: level as 2 | 3 })
              .run()
        })),
        [
          {
            label: state.link ? 'Remove link' : 'Add link',
            icon: state.link ? Link2Off : Link2,
            active: state.link,
            action: toggleLink
          },
          { label: 'Clear formatting', icon: Eraser, action: clearFormatting }
        ],
        [
          {
            label: 'Undo',
            icon: Undo2,
            disabled: !state.canUndo,
            action: () => editor?.chain().focus().undo().run()
          },
          {
            label: 'Redo',
            icon: Redo2,
            disabled: !state.canRedo,
            action: () => editor?.chain().focus().redo().run()
          }
        ]
      ]
    : []) as Control[][];
</script>

<div class="grid gap-1.5">
  <span class="text-[13px] font-semibold text-ink/65">{label}</span>

  <div
    class="overflow-hidden rounded-md border border-ink/15 bg-black/[0.02] transition focus-within:border-forest focus-within:bg-surface focus-within:ring-2 focus-within:ring-forest/20"
  >
    <div class="flex flex-wrap items-center gap-0.5 border-b border-ink/10 px-1.5 py-1.5" role="toolbar" aria-label="{label} formatting">
      {#each groups as group, groupIndex}
        {#if groupIndex > 0 && group.length}
          <span class="mx-1 h-5 w-px bg-ink/12" aria-hidden="true"></span>
        {/if}
        {#each group.filter((control) => !compact || !['Underline', 'Quote', 'Heading 2', 'Heading 3'].includes(control.label)) as control}
          <CmsButton variant="ghost"
            type="button"
            class={["grid h-8 min-w-8 place-items-center rounded px-1.5 text-ink/70 transition hover:bg-ink/[0.07] hover:text-ink disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40", {"bg-forest": control.active, "text-white": control.active, "hover:bg-forest": control.active, "hover:text-white": control.active}]}
            
            
            
            
            title={control.label}
            aria-label={control.label}
            aria-pressed={control.active ?? false}
            disabled={control.disabled ?? false}
            onclick={control.action}
          >
            {#if control.icon}
              <svelte:component this={control.icon} size={15} />
            {:else}
              <span class="text-[12px] font-bold">{control.text}</span>
            {/if}
          </CmsButton>
        {/each}
      {/each}
    </div>

    <div class="admin-rich" style={`--rich-min-height: ${Math.max(rows, 3) * 1.6}rem`} bind:this={element}></div>
  </div>

  {#if maxChars}
    <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      {#if hint}<span class="text-[12px] text-ink/45">{hint}</span>{/if}
      <span id={`${name}-counter`} class={`cms-field-hint ml-auto text-right ${overBy > 0 ? 'font-semibold text-destructive' : ''}`}>
        {textLength}/{maxChars} characters{#if overBy > 0} · {overBy} over — shorten it to save{/if}
      </span>
    </div>
  {:else if hint}
    <span class="text-[12px] text-ink/45">{hint}</span>
  {/if}

  <!-- Keeps the value inside a normal form submit, matching AdminTextArea. -->
  <input type="hidden" {name} {value} />
</div>

<style>
:global {
 .key2africa-admin-surface {

  /* ProseMirror renders into a plain contenteditable, so these have to be
     :global — scoped under .admin-rich so they touch nothing else. */
  .admin-rich .admin-rich-surface {
    min-height: var(--rich-min-height, 8rem);
    padding: 0.7rem 0.875rem;
    font-size: 0.875rem;
    line-height: 1.7;
    color: rgb(var(--c-ink));
    outline: none;
  }

  .admin-rich .admin-rich-surface > * + * {
    margin-top: 0.75em;
  }

  .admin-rich h2,
  .admin-rich h3 {
    font-family: 'Source Serif 4', Georgia, serif;
    font-weight: 600;
    color: rgb(var(--c-heading));
  }

  .admin-rich h2 {
    font-size: 1.4em;
  }

  .admin-rich h3 {
    font-size: 1.18em;
  }

  .admin-rich ul,
  .admin-rich ol {
    padding-left: 1.35em;
  }

  .admin-rich ul {
    list-style: disc;
  }

  .admin-rich ol {
    list-style: decimal;
  }

  .admin-rich li + li {
    margin-top: 0.3em;
  }

  .admin-rich blockquote {
    border-left: 2px solid rgb(var(--c-goldfinch-gold));
    padding-left: 0.9em;
    font-style: italic;
  }

  .admin-rich a {
    color: rgb(var(--c-forest));
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .admin-rich strong {
    font-weight: 700;
  }

  /* Placeholder for an empty document. */
  .admin-rich p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
    color: rgb(var(--c-ink) / 0.35);
  }

 }
}
</style>
