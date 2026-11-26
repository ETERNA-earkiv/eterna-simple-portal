import { describe, it, expect } from 'vitest';
import { isSafeLinkUrl, normalizeStartConfig, parseStartBody } from './start-config';

describe('normalizeStartConfig', () => {
  it('returnerar null när nyckeln saknas eller har fel typ', () => {
    expect(normalizeStartConfig(undefined)).toBeNull();
    expect(normalizeStartConfig(null)).toBeNull();
    expect(normalizeStartConfig('text')).toBeNull();
    expect(normalizeStartConfig({})).toBeNull();
    expect(normalizeStartConfig({ sections: [] })).toBeNull();
  });

  it('behåller rubrik, infotext och giltiga avsnitt', () => {
    expect(normalizeStartConfig({
      title: ' Sök i portalen ',
      infoText: 'Tips',
      sections: [
        { heading: 'Rubrik', body: 'Text', link: { label: 'Länk', url: '/filer/lista.pdf' } },
        { body: 'Bara text' },
      ],
    })).toEqual({
      title: 'Sök i portalen',
      infoText: 'Tips',
      sections: [
        { heading: 'Rubrik', body: 'Text', link: { label: 'Länk', url: '/filer/lista.pdf' } },
        { body: 'Bara text' },
      ],
    });
  });

  it('fungerar med bara rubrik', () => {
    expect(normalizeStartConfig({ title: 'Sök i portalen' })).toEqual({
      title: 'Sök i portalen',
      sections: [],
    });
  });

  it('plockar bort avsnitt utan brödtext i stället för att krascha', () => {
    const result = normalizeStartConfig({
      sections: [{ heading: 'Utan text' }, { body: '   ' }, 'fel typ', null, { body: 42 }, { body: 'Giltig' }],
    });
    expect(result).toEqual({ sections: [{ body: 'Giltig' }] });
  });

  it('hanterar sections som inte är en lista', () => {
    expect(normalizeStartConfig({ title: 'Rubrik', sections: 'fel' })).toEqual({
      title: 'Rubrik',
      sections: [],
    });
  });

  it('plockar bort ofullständiga och osäkra länkar men behåller avsnittet', () => {
    const result = normalizeStartConfig({
      sections: [
        { body: 'A', link: { label: 'Saknar adress' } },
        { body: 'B', link: { label: 'Skript', url: 'javascript:alert(1)' } },
        { body: 'C', link: { label: 'Annan värd', url: '//exempel.se/fil.pdf' } },
      ],
    });
    expect(result).toEqual({ sections: [{ body: 'A' }, { body: 'B' }, { body: 'C' }] });
  });
});

describe('isSafeLinkUrl', () => {
  it('tillåter http, https, mailto och lokala sökvägar', () => {
    expect(isSafeLinkUrl('https://exempel.se/fil.pdf')).toBe(true);
    expect(isSafeLinkUrl('http://exempel.se')).toBe(true);
    expect(isSafeLinkUrl('mailto:info@exempel.se')).toBe(true);
    expect(isSafeLinkUrl('/filer/lista.pdf')).toBe(true);
  });

  it('nekar andra scheman och relativa sökvägar', () => {
    expect(isSafeLinkUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeLinkUrl('data:text/html,x')).toBe(false);
    expect(isSafeLinkUrl('//exempel.se')).toBe(false);
    expect(isSafeLinkUrl('filer/lista.pdf')).toBe(false);
  });
});

describe('parseStartBody', () => {
  it('delar i stycken vid blankrad och behåller radbrytningar', () => {
    expect(parseStartBody('Första\nmed radbrytning\n\nAndra')).toEqual([
      { type: 'paragraph', text: 'Första\nmed radbrytning' },
      { type: 'paragraph', text: 'Andra' },
    ]);
  });

  it('gör numrerade rader till en lista', () => {
    expect(parseStartBody('1. Skriv ett ord.\n2. Klicka på Sök.\n\nVill du se alla träffar?')).toEqual([
      { type: 'list', start: 1, items: ['Skriv ett ord.', 'Klicka på Sök.'] },
      { type: 'paragraph', text: 'Vill du se alla träffar?' },
    ]);
  });

  it('behåller startnumret', () => {
    expect(parseStartBody('3) Tredje\n4) Fjärde')).toEqual([
      { type: 'list', start: 3, items: ['Tredje', 'Fjärde'] },
    ]);
  });

  it('låter en ensam numrerad rad och blandade rader vara stycken', () => {
    expect(parseStartBody('1. Bara en rad')).toEqual([
      { type: 'paragraph', text: '1. Bara en rad' },
    ]);
    expect(parseStartBody('1. Numrerad\nInte numrerad')).toEqual([
      { type: 'paragraph', text: '1. Numrerad\nInte numrerad' },
    ]);
  });

  it('hoppar över tomma stycken', () => {
    expect(parseStartBody('\n\nText\n\n\n\n')).toEqual([{ type: 'paragraph', text: 'Text' }]);
  });
});
