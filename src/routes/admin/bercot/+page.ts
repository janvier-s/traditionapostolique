import type { Author, Quote, Topic, BercotEntry, Work } from '$lib/schema';

export const ssr = false;

export async function load({ fetch }) {
	const [topics, quotes, authors, works, bercot] = await Promise.all([
		fetch('/admin/api/topics').then((r) => r.json() as Promise<Topic[]>),
		fetch('/admin/api/quotes').then((r) => r.json() as Promise<Quote[]>),
		fetch('/admin/api/authors').then((r) => r.json() as Promise<Author[]>),
		fetch('/admin/api/works').then((r) => r.json() as Promise<Work[]>),
		fetch('/admin/api/bercot').then((r) => r.json() as Promise<BercotEntry[]>)
	]);
	return { topics, quotes, authors, works, bercot };
}
