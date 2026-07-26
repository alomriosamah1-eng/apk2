/** Extracts the file extension from a filename (lowercased, without the dot). */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length <= 1) return '';
  return (parts.pop() as string).toLowerCase();
}

/** Returns the filename without its extension. */
export function getFileNameWithoutExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? filename : filename.substring(0, idx);
}

/** Formats a byte count into a human-readable string (e.g. "1.5 MB"). */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/** Extracts the top-level category from a MIME type (e.g. "image" from "image/png"). */
export function getMimeCategory(mimeType: string): string {
  if (!mimeType) return 'file';
  const category = mimeType.split('/')[0];
  return category ?? 'file';
}
