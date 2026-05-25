import { describe, it, expect } from 'vitest';
import type { Topic } from '$lib/schema';
import { isTheme, primaryAspectOf, themeOf, aspectsOf } from './topic-helpers';

const mk = (id: number, extras: Partial<Topic> = {}): Topic => ({
  id, slug: `t${id}`, label: `T${id}`, ...extras
});

describe('isTheme', () => {
  it('true for a root with children', () => {
    const all = [mk(1), mk(2, { parentId: 1 })];
    expect(isTheme(1, all)).toBe(true);
  });
  it('false for a standalone root (no children)', () => {
    expect(isTheme(1, [mk(1)])).toBe(false);
  });
  it('false for a child topic', () => {
    expect(isTheme(2, [mk(1), mk(2, { parentId: 1 })])).toBe(false);
  });
});

describe('primaryAspectOf', () => {
  it('returns the child with primary:true', () => {
    const all = [mk(1), mk(2, { parentId: 1 }), mk(3, { parentId: 1, primary: true })];
    expect(primaryAspectOf(1, all)?.id).toBe(3);
  });
  it('returns undefined when no primary is set', () => {
    expect(primaryAspectOf(1, [mk(1), mk(2, { parentId: 1 })])).toBeUndefined();
  });
});

describe('themeOf', () => {
  it('returns the parent topic of an aspect', () => {
    const all = [mk(1), mk(2, { parentId: 1 })];
    expect(themeOf(2, all)?.id).toBe(1);
  });
  it('returns undefined for a root topic', () => {
    expect(themeOf(1, [mk(1)])).toBeUndefined();
  });
});

describe('aspectsOf', () => {
  it('returns all children of a theme', () => {
    const all = [mk(1), mk(2, { parentId: 1 }), mk(3, { parentId: 1 }), mk(4)];
    const result = aspectsOf(1, all).map((t) => t.id).sort();
    expect(result).toEqual([2, 3]);
  });
  it('returns [] for a standalone root', () => {
    expect(aspectsOf(1, [mk(1)])).toEqual([]);
  });
});
