# Amani frontend

SvelteKit with TypeScript, Svelte 5, Tailwind CSS 4, shadcn-svelte, and the Node adapter. The start page adapts the supplied Tanzania safari UI and local photo assets to the existing Express API.

See the [root README](../../README.md) for commands and environment setup, and the [integration guide](../../docs/frontend-integration.md) for endpoint and field mappings.

Run `npm run dev:frontend` from the repository root. Backend credentials stay in `apps/backend/.env`; the private frontend `API_BASE_URL` points to the API. The reference assets keep the page available while the database is unconfigured. Actual tour inventory and enquiry storage require a working API/database.
