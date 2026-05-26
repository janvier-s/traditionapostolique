/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				background: 'var(--color-bg)',
				foreground: 'var(--color-fg)',
				panel: 'var(--color-panel)',
				accent: 'var(--color-accent)',
				'accent-text': 'var(--color-accent-text)',
				active: 'var(--color-active)',
				muted: 'var(--color-muted)',
				subtle: 'var(--color-subtle)',
				border: 'var(--color-border)',
				heading: 'var(--color-heading)'
			},
			borderColor: {
				DEFAULT: 'var(--color-border)'
			},
			fontFamily: {
				body: 'var(--font-body)',
				ui: 'var(--font-ui)',
				heading: 'var(--font-heading)'
			},
			maxWidth: {
				reader: '750px'
			}
		}
	},
	plugins: []
};
