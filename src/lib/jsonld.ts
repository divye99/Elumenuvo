/** JSON.stringify for <script type="application/ld+json"> blocks: escapes
 *  "<" so no value can break out of the script element. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
