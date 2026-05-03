import { HttpParseError } from "./errors";
import { parseHttpVersion } from "./parse-request-line";
import type { HttpVersion } from "./types";

/**
 * RFC 9112 §4 — status-line = HTTP-version SP status-code SP [ reason-phrase ] CRLF
 *
 * - status-code: 정확히 3자리 숫자
 * - reason-phrase: 빈 문자열 허용 (관용 / RFC 9112 §4 OBS — 의미 무시)
 */
export interface StatusLine {
  httpVersion: HttpVersion;
  statusCode: number;
  reasonPhrase: string;
}

export function parseStatusLine(line: string): StatusLine {
  if (line.length === 0) {
    throw new HttpParseError(400, "empty status line");
  }
  const firstSp = line.indexOf(" ");
  if (firstSp <= 0) {
    throw new HttpParseError(400, "missing SP after HTTP-version");
  }
  const versionRaw = line.slice(0, firstSp);
  const httpVersion = parseHttpVersion(versionRaw);

  const rest = line.slice(firstSp + 1);
  // status-code는 3자리. 그 다음 SP 또는 EOL.
  if (rest.length < 3) {
    throw new HttpParseError(400, "missing status code");
  }
  const codeStr = rest.slice(0, 3);
  if (!/^\d{3}$/.test(codeStr)) {
    throw new HttpParseError(400, `invalid status code: ${JSON.stringify(codeStr)}`);
  }
  const statusCode = Number(codeStr);

  let reasonPhrase = "";
  if (rest.length === 3) {
    // reason-phrase 생략 (관용)
  } else if (rest.charCodeAt(3) !== 0x20) {
    throw new HttpParseError(400, "expected SP after status code");
  } else {
    reasonPhrase = rest.slice(4);
    // reason-phrase는 VCHAR/SP/HTAB만. CTL 금지.
    for (let i = 0; i < reasonPhrase.length; i++) {
      const c = reasonPhrase.charCodeAt(i);
      if (c < 0x20 && c !== 0x09) {
        throw new HttpParseError(400, "invalid byte in reason-phrase");
      }
    }
  }

  return { httpVersion, statusCode, reasonPhrase };
}
