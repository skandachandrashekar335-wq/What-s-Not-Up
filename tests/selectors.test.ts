/**
 * Tests for src/content/selectors.ts
 *
 * queryAll and queryOne should find elements by the fallback selector chain
 * and fail gracefully when selectors are malformed or nothing matches.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { queryAll, queryOne } from '../src/content/selectors';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('queryAll', () => {
  it('returns matching elements for the first working selector', () => {
    document.body.innerHTML = '<span class="selectable-text">A</span><span class="selectable-text">B</span>';
    const result = queryAll(['span.selectable-text']);
    expect(result.length).toBe(2);
  });

  it('falls through to the second selector when the first matches nothing', () => {
    document.body.innerHTML = '<div data-testid="last-msg">preview</div>';
    const result = queryAll(['span.no-match', '[data-testid="last-msg"]']);
    expect(result.length).toBe(1);
    expect(result[0].getAttribute('data-testid')).toBe('last-msg');
  });

  it('returns an empty array when nothing matches', () => {
    const result = queryAll(['[data-nonexistent]', '.also-nonexistent']);
    expect(result).toEqual([]);
  });

  it('silently skips malformed selectors', () => {
    document.body.innerHTML = '<span class="ok">x</span>';
    // ':::bad' is an invalid CSS selector; queryAll must not throw
    const result = queryAll([':::bad', 'span.ok']);
    expect(result.length).toBe(1);
  });

  it('can scope to a subtree element', () => {
    document.body.innerHTML = '<div id="a"><span class="x">in a</span></div><span class="x">out</span>';
    const root = document.getElementById('a')!;
    const result = queryAll(['span.x'], root);
    expect(result.length).toBe(1);
    expect(result[0].textContent).toBe('in a');
  });
});

describe('queryOne', () => {
  it('returns the first matching element', () => {
    document.body.innerHTML = '<div data-testid="status">online</div>';
    const el = queryOne(['[data-testid="status"]']);
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-testid')).toBe('status');
  });

  it('returns null when nothing matches', () => {
    const el = queryOne(['[data-nonexistent]']);
    expect(el).toBeNull();
  });

  it('silently skips malformed selectors', () => {
    document.body.innerHTML = '<div class="ok">x</div>';
    const el = queryOne([':::bad', 'div.ok']);
    expect(el).not.toBeNull();
  });
});
