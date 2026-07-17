export function chunkText(text: string, chunkSize = 700, overlap = 80): string[] {
  const cleaned = text.replace(/\r/g, "").trim();
  if (!cleaned) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(cleaned.length, start + chunkSize);
    chunks.push(cleaned.slice(start, end));
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}
