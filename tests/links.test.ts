import { describe, expect, it } from 'vitest';
import { labelFor, linkify, parseLinks, stripLinks, voiceText } from '../server/links';

describe('links in replies', () => {
  it('names a link by its handle, not its URL', () => {
    expect(labelFor('https://github.com/ArmanDamirchilou')).toBe('ArmanDamirchilou');
    expect(labelFor('https://x.com/ArmanDamir5923')).toBe('ArmanDamir5923');
    expect(labelFor('https://t.me/armandamirchilou')).toBe('armandamirchilou');
    expect(labelFor('https://www.linkedin.com/in/arman-damirchilou-a98322369/')).toBe('Arman Damirchilou');
    expect(labelFor('https://example.com/some/page')).toBe('example.com');
  });

  it('leaves existing links alone when linking bare URLs', () => {
    const text = 'See [my code](https://github.com/ArmanDamirchilou) and https://t.me/armandamirchilou.';
    expect(linkify(text)).toBe('See [my code](https://github.com/ArmanDamirchilou) and [armandamirchilou](https://t.me/armandamirchilou).');
  });

  it('reduces links to their labels for the voice and captions', () => {
    expect(stripLinks('GitHub: [ArmanDamirchilou](https://github.com/ArmanDamirchilou).')).toBe('GitHub: ArmanDamirchilou.');
  });

  it('splits a reply into text and links, and refuses unsafe ones', () => {
    expect(parseLinks('Try [this](/contact) or [that](javascript:void0).')).toEqual([
      { text: 'Try ' },
      { text: 'this', href: '/contact' },
      { text: ' or ' },
      { text: 'that' },
      { text: '.' },
    ]);
    expect(parseLinks('[x](//evil.com)')).toEqual([{ text: 'x' }]);
  });

  it('says addresses and handles the way a person would', () => {
    expect(voiceText('Mail armandamirchilou@gmail.com or ping @armandamirchilou.')).toBe(
      'Mail armandamirchilou at gmail dot com or ping armandamirchilou.'
    );
  });
});
