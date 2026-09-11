/**
 * Remove Vietnamese accents/diacritics and convert to lowercase
 * Example: "Tiểu đoàn không người lái 438" -> "tieu doan khong nguoi lai 438"
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Check if a target string matches a search query without distinguishing accents or case
 */
export function matchSearch(target: string | undefined | null, query: string): boolean {
  if (!target && !query) return true;
  if (!query) return true;
  if (!target) return false;
  const cleanTarget = removeVietnameseTones(target);
  const cleanQuery = removeVietnameseTones(query);
  return cleanTarget.includes(cleanQuery);
}
