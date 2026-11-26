import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isPdf,
  normalizeFileName,
  readUploadedFile,
  saveUploadedFile,
} from './uploaded-files';

const PDF = new TextEncoder().encode('%PDF-1.7\nexempel');

describe('normalizeFileName', () => {
  it('gör om till små bokstäver och bindestreck', () => {
    expect(normalizeFileName('Skannade handlingar tematiskt 261126.pdf'))
      .toBe('skannade-handlingar-tematiskt-261126.pdf');
  });

  it('ersätter å, ä, ö och accenter', () => {
    expect(normalizeFileName('Översikt ÅÄÖ é.PDF')).toBe('oversikt-aao-e.pdf');
  });

  it('behåller understreck och siffror', () => {
    expect(normalizeFileName('lista_2026.pdf')).toBe('lista_2026.pdf');
  });

  it('tar bort extra punkter i namnet', () => {
    expect(normalizeFileName('rapport.exe.pdf')).toBe('rapport-exe.pdf');
  });

  it('nekar andra filändelser', () => {
    expect(normalizeFileName('rapport.docx')).toBeNull();
    expect(normalizeFileName('rapport.pdf.exe')).toBeNull();
    expect(normalizeFileName('rapport')).toBeNull();
  });

  it('nekar sökvägar', () => {
    expect(normalizeFileName('../hemlig.pdf')).toBeNull();
    expect(normalizeFileName('mapp/fil.pdf')).toBeNull();
    expect(normalizeFileName('mapp\\fil.pdf')).toBeNull();
  });

  it('nekar namn som blir tomma', () => {
    expect(normalizeFileName('.pdf')).toBeNull();
    expect(normalizeFileName('---.pdf')).toBeNull();
    expect(normalizeFileName('')).toBeNull();
  });

  it('nekar för långa namn', () => {
    expect(normalizeFileName(`${'a'.repeat(101)}.pdf`)).toBeNull();
    expect(normalizeFileName(`${'a'.repeat(100)}.pdf`)).toBe(`${'a'.repeat(100)}.pdf`);
  });
});

describe('isPdf', () => {
  it('godkänner innehåll som börjar med %PDF-', () => {
    expect(isPdf(PDF)).toBe(true);
  });

  it('nekar annat innehåll', () => {
    expect(isPdf(new TextEncoder().encode('<html>'))).toBe(false);
    expect(isPdf(new TextEncoder().encode('%PD'))).toBe(false);
    expect(isPdf(new Uint8Array())).toBe(false);
  });
});

describe('saveUploadedFile och readUploadedFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'portal-filer-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('sparar en fil som sedan går att läsa', async () => {
    const result = await saveUploadedFile(dir, 'lista.pdf', PDF);
    expect(result).toEqual({ replaced: false });
    expect(await readUploadedFile(dir, 'lista.pdf')).toEqual(PDF);
  });

  it('skapar mappen om den saknas', async () => {
    const nested = join(dir, 'filer');
    await saveUploadedFile(nested, 'lista.pdf', PDF);
    expect(await readUploadedFile(nested, 'lista.pdf')).toEqual(PDF);
  });

  it('ersätter en fil med samma namn', async () => {
    await writeFile(join(dir, 'lista.pdf'), 'gammal');
    const ny = new TextEncoder().encode('%PDF-1.7\nny');
    const result = await saveUploadedFile(dir, 'lista.pdf', ny);
    expect(result).toEqual({ replaced: true });
    expect(await readUploadedFile(dir, 'lista.pdf')).toEqual(ny);
  });

  it('lämnar inga tillfälliga filer kvar', async () => {
    await saveUploadedFile(dir, 'lista.pdf', PDF);
    expect(await readdir(dir)).toEqual(['lista.pdf']);
  });

  it('returnerar null för en fil som inte finns', async () => {
    expect(await readUploadedFile(dir, 'saknas.pdf')).toBeNull();
  });
});
