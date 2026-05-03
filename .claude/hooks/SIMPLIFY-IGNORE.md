# simplify-ignore 훅

`/code-simplify`를 위한 블록 단위 보호. 절대 단순화하지 말아야 할 코드를 표시 — 모델이 그 부분을 보지 못하게 합니다.

## 설정

1. 보호하고 싶은 블록에 주석을 답니다:

```js
/* simplify-ignore-start: perf-critical */
// 수동으로 풀린 XOR — 루프보다 3배 빠름
result[0] = buf[0] ^ key[0];
result[1] = buf[1] ^ key[1];
result[2] = buf[2] ^ key[2];
result[3] = buf[3] ^ key[3];
/* simplify-ignore-end */
```

2. `.claude/settings.json`에 훅을 추가합니다:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PROJECT_DIR}/hooks/simplify-ignore.sh" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PROJECT_DIR}/hooks/simplify-ignore.sh" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PROJECT_DIR}/hooks/simplify-ignore.sh" }]
      }
    ]
  }
}
```

3. `/code-simplify`를 실행 — 보호된 블록은 `/* BLOCK_de115a1d: perf-critical */` 플레이스홀더로 바뀝니다. 모델은 보호된 구현을 보지 않고 주변 코드만 추론합니다.

> **참고:** 훅은 임시 백업을 `.claude/.simplify-ignore-cache/`에 저장합니다. 이 경로가 `.gitignore`에 포함되어 있는지 확인하세요.

## 동작 방식

하나의 스크립트, 세 가지 훅 이벤트:

| 이벤트 | 동작 |
|---|---|
| `PreToolUse Read` | 파일을 백업하고 블록을 `BLOCK_<hash>` 플레이스홀더로 인플레이스 교체 |
| `PostToolUse Edit\|Write` | 플레이스홀더를 실제 코드로 확장, 모델의 변경 저장, 재필터링 |
| `Stop` | 세션 종료 시 백업에서 모든 파일 복원 |

각 블록은 내용 해시됩니다(`shasum`/`sha1sum`으로 8자리 16진수) — 모델이 플레이스홀더를 복제하거나 재정렬해도 왕복이 명확합니다. 캐시는 세션 간 간섭 방지를 위해 프로젝트 범위입니다.

## 주석 구문

```js
/* simplify-ignore-start */           // 기본 — 블록 숨김
/* simplify-ignore-start: reason */   // reason 포함 — 플레이스홀더에 표시됨
/* simplify-ignore-end */
```

모든 주석 스타일이 동작합니다 (`//`, `/*`, `#`, `<!--`). 파일당 여러 블록과 단일 라인 블록을 지원. 플레이스홀더는 원본 주석 구문을 보존합니다 (예: Python은 `# BLOCK_xxx`, HTML은 `<!-- BLOCK_xxx -->`).

## 크래시 복구

Claude Code가 Stop 훅을 트리거하지 않고 크래시하면 디스크의 파일에 `BLOCK_<hash>` 플레이스홀더가 남을 수 있습니다. 수동 복원:

```bash
echo '{}' | bash hooks/simplify-ignore.sh
```

백업은 프로젝트 디렉터리 내 `.claude/.simplify-ignore-cache/`에 저장됩니다.

## 알려진 제한

- **단일 라인 블록은 전체 라인을 숨깁니다.** `simplify-ignore-start`와 `simplify-ignore-end`가 다른 코드와 같은 라인에 나타나면, 주석 처리된 부분만이 아니라 전체 라인이 모델로부터 숨겨집니다. 주석은 전용 라인에 두세요.
- **주석 접미어 감지는 `*/`와 `-->`만 지원.** 비표준 주석 종결자를 쓰는 템플릿 엔진(ERB `%>`, Blade `--}}`)은 불균형 플레이스홀더를 만들 수 있습니다. 대신 `#` 또는 `//` 스타일 주석을 쓰세요.
- **폴백 확장은 점진적이며 정확하지 않음.** 모델이 플레이스홀더의 형식을 변경하면(예: reason 텍스트 변경), 훅은 점진적으로 더 단순한 매치를 시도합니다: 전체 플레이스홀더 → 접두어+해시+접미어 → 해시만. 해시만 폴백은 화장용 찌꺼기(흩어진 `:` 또는 reason 텍스트)를 남길 수 있습니다. 이 경우 stderr에 경고가 출력됩니다.
- **파일 이름 변경 시 플레이스홀더가 남음.** 모델이 쉘 커맨드로 파일을 이름 변경 또는 이동하면, 새 파일에 `BLOCK_<hash>` 플레이스홀더가 남습니다. 세션이 멈출 때 원본 코드는 `<old-filename>.recovered`로 저장됩니다. 복구된 코드를 새 파일에 수동으로 복원해야 합니다.

## 요구 사항

- `jq`, `shasum` 또는 `sha1sum` (자동 감지), Bash 3.2+
