/**
 * Uppladdning av PDF-filer från adminytan.
 */

export interface UploadedFile {
  /** Filnamnet som servern sparade filen under (rensat). */
  name: string;
  /** Publik adress, t.ex. /filer/lista.pdf */
  url: string;
  size: number;
  /** true om en fil med samma namn ersattes. */
  replaced: boolean;
}

export async function uploadPdf(file: File): Promise<UploadedFile> {
  const res = await fetch(`/api/files/${encodeURIComponent(file.name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    credentials: 'include',
    body: file,
  });

  const data = await res.json().catch(() => null) as (UploadedFile & { error?: string }) | null;
  if (!res.ok || !data) {
    throw new Error(data?.error || 'Kunde inte ladda upp filen.');
  }
  return data;
}
