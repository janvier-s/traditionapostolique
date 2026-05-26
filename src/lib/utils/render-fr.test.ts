import { describe, it, expect } from 'vitest';
import { renderFr, escapeHtml } from './render-fr';

describe('renderFr', () => {
	it('returns empty string for null/undefined/empty', () => {
		expect(renderFr(null)).toBe('');
		expect(renderFr(undefined)).toBe('');
		expect(renderFr('')).toBe('');
	});

	it('escapes HTML before substituting italics', () => {
		expect(renderFr('*<script>alert(1)</script>*')).toBe(
			'<em>&lt;script&gt;alert(1)&lt;/script&gt;</em>'
		);
	});

	it('wraps *foo* in <em>', () => {
		expect(renderFr('alpha *beta* gamma')).toBe('alpha <em>beta</em> gamma');
	});

	it('does not half-match unbalanced stars', () => {
		// 'a *b' has only one star → no italics.
		expect(renderFr('a *b')).toBe('a *b');
		// '*a *b*' should match only the inner balanced pair, not a half-string.
		expect(renderFr('*a *b*')).not.toContain('<em>a </em>');
	});

	it('requires non-whitespace at both ends of the italic span', () => {
		expect(renderFr('* a *')).toBe('* a *');
		expect(renderFr('*a *')).toBe('*a *');
		expect(renderFr('* a*')).toBe('* a*');
	});

	it('does not span newlines', () => {
		expect(renderFr('*a\nb*')).toBe('*a\nb*');
	});

	it('links a single CEC paragraph reference', () => {
		const out = renderFr('voir CEC §1554 pour plus de détails');
		expect(out).toContain('href="https://catechismecatholique.fr/cec/1554"');
		expect(out).toContain('CEC §1554</a>');
	});

	it('links a CEC range to the first paragraph in href but keeps the range in the label', () => {
		const out = renderFr('cf. CEC §1430-1431');
		expect(out).toContain('href="https://catechismecatholique.fr/cec/1430"');
		expect(out).toContain('CEC §1430-1431</a>');
	});

	it('leaves surrounding parentheses outside the link', () => {
		expect(renderFr('(CEC §1013)')).toMatch(/^\(<a [^>]+>CEC §1013<\/a>\)$/);
	});
});

describe('escapeHtml', () => {
	it('escapes the five sensitive characters', () => {
		expect(escapeHtml(`<a href="x" class='y'>&</a>`)).toBe(
			'&lt;a href=&quot;x&quot; class=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
		);
	});
});
