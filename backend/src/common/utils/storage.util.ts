import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';

// Files (prescription PDFs, diagnostic reports) are kept on disk under
// UPLOAD_DIR and served only through authorised download endpoints.
export function uploadRoot(): string {
  return resolve(process.env.UPLOAD_DIR ?? 'uploads');
}

// Saves bytes under <UPLOAD_DIR>/<folder>/ with a server-chosen name.
// Returns the path relative to UPLOAD_DIR, which is what the database stores.
export async function saveFile(folder: string, data: Buffer, extension: string): Promise<string> {
  const dir = join(uploadRoot(), folder);
  await mkdir(dir, { recursive: true });

  const fileName = `${randomUUID()}.${extension}`;
  await writeFile(join(dir, fileName), data);

  return `${folder}/${fileName}`;
}

// Resolves a stored relative path, refusing anything outside UPLOAD_DIR
export function resolveStored(relativePath: string): string {
  const root = uploadRoot();
  const full = resolve(root, normalize(relativePath));
  const rel = relative(root, full);

  if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) {
    throw new BadRequestException('Invalid file path');
  }

  return full;
}

export async function readStored(relativePath: string): Promise<Buffer> {
  const full = resolveStored(relativePath);

  if (!existsSync(full)) {
    throw new NotFoundException('File not found');
  }

  return readFile(full);
}

// Accepted report uploads: PDF and images, up to 5 MB
export const REPORT_MAX_BYTES = 5 * 1024 * 1024;

export const REPORT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

// Checks the file's first bytes, not just the type the client claims
export function detectReportType(data: Buffer): string | null {
  if (data.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  return null;
}

// Deletes a stored file; a file that is already gone is not an error
export async function removeStored(relativePath: string): Promise<void> {
  try {
    await unlink(resolveStored(relativePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

// Profile photos: PNG, JPG or WebP, up to 2 MB
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export const PHOTO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

// Checks the file's first bytes, not just the type the client claims
export function detectPhotoType(data: Buffer): string | null {
  const type = detectReportType(data);
  if (type === 'image/png' || type === 'image/jpeg') return type;
  if (
    data.subarray(0, 4).toString('latin1') === 'RIFF' &&
    data.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
