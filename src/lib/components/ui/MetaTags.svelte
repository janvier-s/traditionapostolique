<script lang="ts">
	import { page } from '$app/state';

	let {
		title,
		description,
		type = 'website',
		image,
		imageAlt,
		separator = '·',
		noindex = false
	}: {
		title: string;
		description?: string;
		type?: 'website' | 'article';
		image?: string;
		imageAlt?: string;
		separator?: string;
		noindex?: boolean;
	} = $props();

	const SITE_NAME = 'Tradition Apostolique';
	const DEFAULT_IMAGE = '/og-image.png';
	const DEFAULT_IMAGE_ALT = 'Tradition Apostolique · anthologie patristique';

	const full = $derived(`${title} ${separator} ${SITE_NAME}`);

	// Self-canonical URL derived from the current route. Strips trailing
	// slashes (except root) and drops query/hash so duplicate-form URLs
	// collapse into the canonical one.
	const canonical = $derived.by(() => {
		const u = page.url;
		const path = u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : u.pathname;
		return `${u.origin}${path}`;
	});

	// Absolute OG image URL · OG crawlers reject relative paths.
	const absoluteImage = $derived.by(() => {
		const src = image ?? DEFAULT_IMAGE;
		if (/^https?:\/\//i.test(src)) return src;
		return `${page.url.origin}${src.startsWith('/') ? src : `/${src}`}`;
	});
	const finalImageAlt = $derived(imageAlt ?? DEFAULT_IMAGE_ALT);
</script>

<svelte:head>
	<title>{full}</title>
	{#if description}<meta name="description" content={description} />{/if}
	<link rel="canonical" href={canonical} />
	{#if noindex}<meta name="robots" content="noindex,follow" />{/if}

	<!-- Open Graph -->
	<meta property="og:title" content={full} />
	{#if description}<meta property="og:description" content={description} />{/if}
	<meta property="og:type" content={type} />
	<meta property="og:url" content={canonical} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content="fr_FR" />
	<meta property="og:image" content={absoluteImage} />
	<meta property="og:image:alt" content={finalImageAlt} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={full} />
	{#if description}<meta name="twitter:description" content={description} />{/if}
	<meta name="twitter:image" content={absoluteImage} />
	<meta name="twitter:image:alt" content={finalImageAlt} />
</svelte:head>
