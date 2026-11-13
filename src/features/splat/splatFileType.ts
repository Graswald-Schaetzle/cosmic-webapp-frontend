import { SplatFileType } from '@sparkjsdev/spark';

// Signed download URLs carry a query string (?X-Goog-Signature=...), so the file extension has
// to be read from the URL path. Unknown extensions are left to Spark's content detection.
export const getSplatFileType = (url: string): SplatFileType | undefined => {
  let path = url;
  try {
    path = new URL(url, window.location.href).pathname;
  } catch {
    // keep the raw string
  }
  path = path.toLowerCase();
  if (path.endsWith('.spz')) return SplatFileType.SPZ;
  if (path.endsWith('.ply')) return SplatFileType.PLY;
  if (path.endsWith('.ksplat')) return SplatFileType.KSPLAT;
  if (path.endsWith('.splat')) return SplatFileType.SPLAT;
  if (path.endsWith('.sog')) return SplatFileType.PCSOGSZIP;
  return undefined;
};
