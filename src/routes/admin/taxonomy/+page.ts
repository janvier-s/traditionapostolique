import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { Topic, Taxonomy } from '$lib/schema';

export const ssr = false;

export async function load({ fetch }) {
	if (!dev) throw error(404);
	const [topics, taxonomy] = await Promise.all([
		fetch('/admin/api/topics').then((r) => r.json() as Promise<Topic[]>),
		fetch('/admin/api/taxonomy').then((r) => r.json() as Promise<Taxonomy>)
	]);
	return { topics, taxonomy };
}
