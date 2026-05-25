import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { Topic, Quote, BercotEntry } from '$lib/schema';

export const ssr = false;

export async function load({ fetch }) {
  if (!dev) throw error(404);
  const [topics, quotes, bercot] = await Promise.all([
    fetch('/admin/api/topics').then((r) => r.json() as Promise<Topic[]>),
    fetch('/admin/api/quotes').then((r) => r.json() as Promise<Quote[]>),
    fetch('/admin/api/bercot').then((r) => r.json() as Promise<BercotEntry[]>)
  ]);
  return { topics, quotes, bercot };
}
