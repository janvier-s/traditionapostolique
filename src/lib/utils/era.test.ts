import { describe, it, expect } from 'vitest';
import { eraLabel, eraMidpoint, eraOrder } from './era';

describe('era', () => {
	it('returns French labels', () => {
		expect(eraLabel('apostolic')).toBe('Pères apostoliques');
		expect(eraLabel('ante-nicene')).toBe('Pré-nicéens');
		expect(eraLabel('nicene')).toBe('Nicéens');
		expect(eraLabel('post-nicene')).toBe('Post-nicéens');
		expect(eraLabel('medieval')).toBe('Médiévaux');
	});
	it('returns a numeric midpoint per era', () => {
		expect(eraMidpoint('apostolic')).toBeLessThan(eraMidpoint('ante-nicene'));
		expect(eraMidpoint('ante-nicene')).toBeLessThan(eraMidpoint('nicene'));
		expect(eraMidpoint('nicene')).toBeLessThan(eraMidpoint('post-nicene'));
		expect(eraMidpoint('post-nicene')).toBeLessThan(eraMidpoint('medieval'));
	});
	it('orders the eras chronologically', () => {
		expect(eraOrder).toEqual(['apostolic', 'ante-nicene', 'nicene', 'post-nicene', 'medieval']);
	});
});
