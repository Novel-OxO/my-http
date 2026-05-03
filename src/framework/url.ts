/**
 * 학습 포인트:
 * - request-target은 origin-form ("/path?query") 위주로 처리한다.
 *   absolute-form (proxy 사용)이나 authority-form은 학습 범위 밖.
 * - URL/URLSearchParams를 쓰면 더 견고하지만, 학습 단순화를 위해 직접 split한다.
 */

export interface ParsedTarget {
  path: string;
  query: string;
  queryParams: Record<string, string>;
}

export function parseRequestTarget(target: string): ParsedTarget {
  const qIdx = target.indexOf("?");
  const path = qIdx < 0 ? target : target.slice(0, qIdx);
  const query = qIdx < 0 ? "" : target.slice(qIdx + 1);
  return { path, query, queryParams: parseQuery(query) };
}

function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (query.length === 0) return out;
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const name = eq < 0 ? pair : pair.slice(0, eq);
    const value = eq < 0 ? "" : pair.slice(eq + 1);
    try {
      out[decodeURIComponent(name)] = decodeURIComponent(value);
    } catch {
      // malformed percent-encoding은 raw로 둔다 (학습용 단순화)
      out[name] = value;
    }
  }
  return out;
}
