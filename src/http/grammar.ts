/**
 * RFC 9110 §5.6.2 token 검증.
 * tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
 *         "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
 */

const TCHAR = new Set<number>();
function init() {
  const add = (s: string) => {
    for (const c of s) TCHAR.add(c.charCodeAt(0));
  };
  add("!#$%&'*+-.^_`|~");
  for (let c = 0x30; c <= 0x39; c++) TCHAR.add(c); // 0-9
  for (let c = 0x41; c <= 0x5a; c++) TCHAR.add(c); // A-Z
  for (let c = 0x61; c <= 0x7a; c++) TCHAR.add(c); // a-z
}
init();

export function isToken(s: string): boolean {
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    if (!TCHAR.has(s.charCodeAt(i))) return false;
  }
  return true;
}

/** OWS = *( SP / HTAB ). RFC 9110 §5.6.3 */
export function trimOWS(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && (s.charCodeAt(start) === 0x20 || s.charCodeAt(start) === 0x09)) start++;
  while (end > start && (s.charCodeAt(end - 1) === 0x20 || s.charCodeAt(end - 1) === 0x09)) end--;
  return s.slice(start, end);
}

export const CR = 0x0d;
export const LF = 0x0a;
export const SP = 0x20;
export const HTAB = 0x09;
