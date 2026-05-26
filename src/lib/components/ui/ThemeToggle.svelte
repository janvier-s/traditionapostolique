<script lang="ts">
	import { theme, setTheme } from '$lib/stores/theme.svelte';

	let {
		title = 'Basculer le thème',
		ariaLabel = 'Basculer le thème',
		class: className = ''
	}: {
		title?: string;
		ariaLabel?: string;
		class?: string;
	} = $props();

	function onClick(e: MouseEvent) {
		const next = theme.value === 'dark' ? 'light' : 'dark';
		// Fallback for browsers without View Transitions (Firefox, older Safari).
		const supportsViewTransitions =
			typeof document !== 'undefined' && 'startViewTransition' in document;
		if (!supportsViewTransitions) {
			setTheme(next);
			return;
		}
		const x = e.clientX;
		const y = e.clientY;
		const endRadius = Math.hypot(
			Math.max(x, window.innerWidth - x),
			Math.max(y, window.innerHeight - y)
		);
		document.documentElement.style.setProperty('--ripple-x', `${x}px`);
		document.documentElement.style.setProperty('--ripple-y', `${y}px`);
		document.documentElement.style.setProperty('--ripple-r', `${endRadius}px`);
		document.startViewTransition(() => setTheme(next));
	}
</script>

<button
	type="button"
	{title}
	aria-label={ariaLabel}
	aria-pressed={theme.value === 'dark'}
	class={className}
	onclick={onClick}
>
	{#if theme.value === 'dark'}
		<!-- Moon (shown in dark mode) -->
		<svg
			width="1em"
			height="1em"
			viewBox="0 0 24 24"
			aria-hidden="true"
			fill="none"
			stroke="currentColor"
			stroke-width="1.4"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
		</svg>
	{:else}
		<!-- Sun (shown in light mode) -->
		<svg
			width="1em"
			height="1em"
			viewBox="0 0 24 24"
			aria-hidden="true"
			fill="none"
			stroke="currentColor"
			stroke-width="1.4"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="12" cy="12" r="3.5" />
			<path d="M12 2.5v2.5" />
			<path d="M12 19v2.5" />
			<path d="M4.5 4.5l1.8 1.8" />
			<path d="M17.7 17.7l1.8 1.8" />
			<path d="M2.5 12h2.5" />
			<path d="M19 12h2.5" />
			<path d="M4.5 19.5l1.8-1.8" />
			<path d="M17.7 6.3l1.8-1.8" />
		</svg>
	{/if}
</button>
