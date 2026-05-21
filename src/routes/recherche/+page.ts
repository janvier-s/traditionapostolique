export const ssr = false;
export async function load({ fetch }) {
	const res = await fetch('/data/search-index.json');
	const json = await res.json();
	return { indexJson: json };
}
