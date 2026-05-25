import type { Topic, Quote } from '$lib/schema';

export const ssr = false;

export async function load({ fetch }) {
	const [topics, quotes] = await Promise.all([
		fetch('/admin/api/topics').then((r) => r.json() as Promise<Topic[]>),
		fetch('/admin/api/quotes').then((r) => r.json() as Promise<Quote[]>)
	]);
	return { topics, quotes };
}
