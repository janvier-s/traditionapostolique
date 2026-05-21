import { describe, it, expect } from 'vitest';
import { atomicWriteJson } from './atomic-write';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('atomicWriteJson', () => {
	it('writes JSON to disk', () => {
		const dir = mkdtempSync(join(tmpdir(), 'awj-'));
		const path = join(dir, 'out.json');
		atomicWriteJson(path, { hello: 'world' });
		expect(JSON.parse(readFileSync(path, 'utf-8'))).toEqual({ hello: 'world' });
	});
});
