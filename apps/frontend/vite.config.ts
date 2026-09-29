import adapter from '@sveltejs/adapter-node';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: { watch: { usePolling: process.env.CHOKIDAR_USEPOLLING === 'true' } },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Keep the restored CMS compatible with legacy Svelte components; new UI uses runes.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') || /[/\\](?:routes|lib)[/\\]admin[/\\]/.test(filename) ? undefined : true
			},

			adapter: adapter()
		})
	]
});
