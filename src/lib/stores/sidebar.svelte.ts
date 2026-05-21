function load(): boolean {
	if (typeof localStorage === 'undefined') return true;
	return localStorage.getItem('sidebar.open') !== 'false';
}

export const sidebar = $state({ open: load(), filter: '' });

export function toggleSidebar() {
	sidebar.open = !sidebar.open;
	if (typeof localStorage !== 'undefined') localStorage.setItem('sidebar.open', String(sidebar.open));
}
