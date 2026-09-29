# Amani frontend integration

The Svelte start page at `/` adapts `TanzaniaSafariPage.tsx` and the photos from the supplied `tanzania-safari-pages.zip`. `/tanzania-safari` redirects to `/`, preserving search parameters. The supplied tour detail design is a reference for future detail pages; this change implements the start page.

## API mapping

All reads happen in `apps/frontend/src/routes/+page.server.ts` through the private `API_BASE_URL`. Responses use the existing `{ success, message, data }` envelope. Lists read `data.items` and `data.pagination`.

| UI | Existing endpoint | Fields used |
| --- | --- | --- |
| Headings, hero and section visibility | `GET /api/homepage` | `section_key`, `title`, `subtitle`, `content`, `image_url`, `button_text`, `button_url`, `is_active`, `sort_order` |
| Experiences | `GET /api/activities?status=published&limit=12` | `id`, `name`, `description`, image/hero URLs and thumbnails |
| Destination tabs and search options | `GET /api/destinations?status=published&limit=100` | `id`, `name`, `slug`, `country`, `region`, descriptions and image URLs |
| Safari style options | `GET /api/categories?status=published&limit=100` | `id`, `name`, `slug` |
| Safari packages | `GET /api/tours` | `title`, `duration_days`, `price_from`, `currency`, `budget_tier`, `destinations`, thumbnail/image URL |
| Enquiries | `POST /api/contact` | `full_name`, `email`, `phone`, `subject`, `message` |

Search only sends supported tour filters: `search`, `destination_id`, `category_id`, `page`, `limit`, and `status=published`. IDs are validated as UUIDs. Travel dates and group sizes are enquiry preferences, not unsupported availability filters. The public search does not request draft tours.

Destination responses are filtered to Tanzania in the frontend because the current destinations endpoint has no country filter. Circuit tabs infer the circuit from `region`, `name`, and `slug`; unmatched places appear under “More Places.” The destination/style pickers show up to 100 published records. Tour results use API pagination.

The SvelteKit enquiry action validates input and forwards only the contact schema fields. Dates, traveler count, and interests are composed into `message`; no database migration is necessary. It forwards the resolved client address for the backend's existing rate limit. On production hosting, configure SvelteKit's trusted proxy/client address settings correctly. A failure preserves form values and never shows a success message. Testing uses a local API stub so no email or real contact record is created.

## Homepage section keys

`hero`, `why_us`, `experiences`, `destinations`, `safari_packages`, `when_to_go`, `how_it_works`, `faq`, and `enquiry` map to the page sections. Existing `sort_order` controls their order. An `is_active: false` marker hides its section and related navigation. Unknown section keys remain untouched by this frontend.

Hero and section copy fall back to the reference design where a section has no CMS record. The seasonal cards are editorial reference content in `src/lib/data/reference.ts`; the `when_to_go` section controls their heading, introductory text, order and visibility. The Amani brand label is currently frontend copy.

When a content endpoint is unreachable, destination and activity imagery fall back to the supplied ZIP's reference copy. A **successful empty response stays empty**, so unpublished content is not repopulated with fixtures. Tours have no sample prices or fabricated live inventory. The page offers an enquiry when tours cannot be loaded. Backend credentials are required for live content and enquiry storage.

## Frontend structure

- `src/lib/types/api.ts`: public backend contracts.
- `src/lib/server/api.ts`: private API client with timeouts and failure handling.
- `src/lib/home-content.ts`: CMS merging, safe links, circuit grouping and validated search filters.
- `src/lib/data/reference.ts`: supplied editorial data, with backend-shaped fallback records.
- `src/lib/components/home/`: header/mega menu, hero, search, Amani approach, experiences, destinations, seasons, planning steps, FAQ, enquiry form, and footer.
- `src/lib/components/ui/`: generated shadcn-svelte components.
- `src/routes/layout.css`: reference navy/yellow theme and locally bundled Poppins fonts.
- `static/images/`: photos supplied in the ZIP.

The planning steps and FAQ answers are local editorial copy. Their section headings, order and visibility use the existing homepage CMS contract; no backend migration is needed. The footer only links to implemented sections and does not invent contact details or social accounts.
