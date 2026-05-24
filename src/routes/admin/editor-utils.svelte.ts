// Shared editor wiring · Cmd/Ctrl+S to save, beforeunload prompt while
// dirty, brief "Saved!" flash after a successful save.

export function bindEditorShortcuts(opts: {
	isDirty: () => boolean;
	isSaving: () => boolean;
	save: () => void | Promise<void>;
}): () => void {
	if (typeof window === 'undefined') return () => {};

	function onKey(e: KeyboardEvent) {
		const meta = e.metaKey || e.ctrlKey;
		if (meta && e.key.toLowerCase() === 's') {
			e.preventDefault();
			if (opts.isDirty() && !opts.isSaving()) void opts.save();
		}
	}

	function onBeforeUnload(e: BeforeUnloadEvent) {
		if (!opts.isDirty()) return;
		e.preventDefault();
		// Modern browsers ignore the message text but require preventDefault
		// (and a non-empty returnValue in some).
		e.returnValue = '';
	}

	window.addEventListener('keydown', onKey);
	window.addEventListener('beforeunload', onBeforeUnload);
	return () => {
		window.removeEventListener('keydown', onKey);
		window.removeEventListener('beforeunload', onBeforeUnload);
	};
}
