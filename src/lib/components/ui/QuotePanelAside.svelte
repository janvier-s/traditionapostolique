<script lang="ts">
	import type { Quote } from '$lib/schema';
	import QuotePanel from './QuotePanel.svelte';

	let {
		quote,
		onClose,
		label = "Plus d'infos sur la citation"
	}: { quote: Quote; onClose: () => void; label?: string } = $props();
</script>

<aside
	aria-label={label}
	class="mt-12 border-t border-border pt-8 lg:mt-0 lg:border-t-0 lg:border-l lg:border-border lg:pl-8 lg:pt-0 lg:sticky lg:top-10 lg:max-h-[calc(100vh-5rem)] lg:flex lg:flex-col lg:overflow-hidden"
>
	{#key quote.id}
		<QuotePanel {quote} {onClose} />
	{/key}
</aside>
