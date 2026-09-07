/**
 * Natural Sort Algorithm for Slide Image Filenames
 * Correctly orders:
 *   Slide1.png, Slide2.png, ..., Slide10.png (NOT Slide1, Slide10, Slide2)
 *   Slide 1.png, Slide 2.png, Slide 10.png
 *   slide01.png, slide02.png, slide10.png
 *   1.png, 2.png, 10.png
 */
export function naturalSortFilenames<T extends { name: string }>(items: T[]): { sorted: T[]; hasUnnumbered: boolean } {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  
  let hasUnnumbered = false;
  for (const item of items) {
    if (!/\d+/.test(item.name)) {
      hasUnnumbered = true;
      break;
    }
  }

  const sorted = [...items].sort((a, b) => collator.compare(a.name, b.name));
  return { sorted, hasUnnumbered };
}
