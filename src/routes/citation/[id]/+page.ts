import { error } from '@sveltejs/kit';
import { quoteById } from '$lib/data';

export function load({ params }) {
	const id = Number(params.id);
	const quote = quoteById(id);
	if (!quote) throw error(404, 'Citation introuvable');
	return { quote };
}
