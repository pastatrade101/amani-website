# Amani website

An npm workspaces monorepo containing the existing Express API and a SvelteKit frontend based on the supplied Tanzania safari design. The original Git history stays in this repository.

```text
apps/
  backend/           Express + TypeScript + Supabase
    src/
    .env.example
  frontend/          SvelteKit + Svelte 5 + Tailwind 4 + shadcn-svelte
    src/routes/      Tanzania landing page and server-side enquiry action
    src/lib/         shadcn UI, homepage sections, and a private API client
    components.json  shadcn-svelte configuration
    .env.example
docs/                Backend reference and operational documentation
Dockerfile           API image; build context is this repository root
package.json         Shared development, build and verification commands
package-lock.json    One lockfile for both workspaces
```

## Local development

Use Node **22.12+ in the 22.x line, or Node 24+** (Node 22 LTS recommended; `.nvmrc` provided) and npm 10+.

```sh
npm ci
npm run dev
```

- Frontend: http://localhost:5173 (Vite uses the next free port if occupied).
- API: http://localhost:5000/api/health.
- `Ctrl+C` stops both applications.

The page renders the supplied editorial copy and photos without credentials. Live tours, CMS content and enquiry storage require Supabase configuration. The API health endpoint indicates that the API process is reachable, not that its database is configured. See [frontend integration](docs/frontend-integration.md) for field mappings and fallback behavior.

For database access or custom ports, copy the examples and configure them:

```sh
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

Backend secrets belong **only** in `apps/backend/.env`. The frontend's private `API_BASE_URL` defaults to `http://127.0.0.1:5000/api`. If you change backend `PORT`, update `API_BASE_URL` to match. No service-role credentials are sent to the browser.

## Commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start both apps together |
| `npm run dev:backend` | Start the API only |
| `npm run dev:frontend` | Start the frontend only |
| `npm run check` | Check backend TypeScript and frontend Svelte/TypeScript |
| `npm test` | Run backend tests and frontend contract tests |
| `npm run build` | Build both applications |
| `npm run build:backend` / `npm run build:frontend` | Build one application |
| `npm run preview` | Preview the built frontend |
| `npm run start:backend` | Run the compiled API |
| `npm run start:frontend` | Run the frontend's Node adapter build (port 3000) |

Backend operational scripts remain available at the root, for example `npm run db:pipeline -- --dry-run` and `npm run email:test -- you@example.com`. They execute in `apps/backend`, so relative file arguments are resolved there. The full database schema is not included in this repository; use `DATABASE_DIR` for an external schema directory.

## UI components

The frontend uses the Svelte implementation of shadcn/ui. Add components from its workspace:

```sh
cd apps/frontend
npx shadcn-svelte@latest add input dialog
```

Import components from `$lib/components/ui/<component>/index.js`. Theme variables live in `apps/frontend/src/routes/layout.css`.

Setup references: [Svelte CLI](https://svelte.dev/docs/cli/sv-create) and [shadcn-svelte](https://www.shadcn-svelte.com/docs/installation/sveltekit).

## Production

`npm run build` outputs `apps/backend/dist` and `apps/frontend/build`. Run the two Node services separately. The frontend's Node adapter reads environment variables from the process in production, so supply `API_BASE_URL`, `HOST`, `PORT`, and `ORIGIN` through your hosting environment. For a local production smoke test, Node can load the frontend file explicitly: `node --env-file=apps/frontend/.env apps/frontend/build`.

The root Dockerfile builds **the API** with `docker build -t amani-api .`. Configure Supabase credentials and a strong `JWT_SECRET` before starting it with `NODE_ENV=production`. Existing deployment examples under `docs/` describe the inherited Goldfinch system; the new frontend implements the Tanzania start page and enquiry flow; CMS, booking, tour-detail and trip-portal screens remain future work.
