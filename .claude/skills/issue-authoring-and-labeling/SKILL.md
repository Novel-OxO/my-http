---
name: issue-authoring-and-labeling
description: devmoa GitHub 이슈를 작성하고 라벨을 올바르게 붙인다. 새 이슈를 만들거나 기존 이슈를 정리할 때, 프로젝트 보드·로드맵 필터가 라벨 기반으로 동작해야 할 때 사용한다.
---

# 이슈 작성과 라벨링

## Overview

이슈는 작업 단위의 진입점이다. 제목·본문·라벨이 일관되지 않으면 보드 필터가 깨지고, 우선순위가 흐려지고, 나중에 온 사람이 맥락을 잃는다.

devmoa는 이슈 기반으로 프로젝트를 관리한다. 모든 이슈는 다음 세 가지를 만족해야 한다.

- **한 가지 일만** 다룬다 (atomic issue)
- **type + scope** 라벨이 반드시 있다
- 본문에 **왜 하는지**와 **끝났는지 판단 기준**이 있다

## When to Use

- 버그를 발견했을 때
- 새 기능·개선 아이디어가 나왔을 때
- 큰 작업을 더 작은 단위로 쪼개야 할 때
- 여러 이슈를 한 번에 만들어 로드맵을 채울 때
- 기존 이슈의 라벨·제목·본문이 규칙과 어긋나 정리해야 할 때

## 라벨 체계 (필수 숙지)

devmoa 레포에는 24개 라벨이 있다. 5개 카테고리로 구분된다.

### type/* — 이슈의 성격 (필수 1개)

| 라벨 | 언제 |
|---|---|
| `type/feat` | 새 기능·엔드포인트·화면·수집기 추가 |
| `type/fix` | 동작이 잘못된 것을 바로잡음 |
| `type/refactor` | 동작 변경 없이 구조 개선 |
| `type/test` | 테스트 추가·수정만 |
| `type/chore` | 빌드·의존성·툴링·설정 |
| `type/docs` | SPEC, README, ADR, 주석 |
| `type/perf` | 성능 개선 (측정 기반) |

**규칙**: 정확히 하나만 선택. 두 개가 필요하면 이슈를 둘로 쪼개라.

### scope/* — 어디를 건드리는가 (필수 1개, 드물게 여러 개)

| 라벨 | 대상 |
|---|---|
| `scope/api` | `apps/api` — Hono |
| `scope/web` | `apps/web` — Next.js |
| `scope/admin` | `apps/admin` — Keystone |
| `scope/db` | `packages/db` — Prisma/Kysely/Zod |
| `scope/infra` | `infra/k8s`, `infra/docker`, 모노레포 루트 |
| `scope/worker` | `worker-batch`, `worker-mailer`, `slack-bot` |

**규칙**: 하나의 이슈가 3개 이상의 scope에 걸치면 거의 확실히 쪼개야 한다. 2개는 허용.

### priority/* — 얼마나 급한가 (선택, 기본 P2)

| 라벨 | 의미 |
|---|---|
| `priority/P0` | 즉시 (장애·배포 차단·보안) |
| `priority/P1` | 높음 (이번 스프린트) |
| `priority/P2` | 보통 (다음 스프린트) — 기본값이므로 생략 가능 |
| `priority/P3` | 낮음 (백로그) |

### status/* — 진행 상태 (수명 동안 0~1개)

| 라벨 | 의미 |
|---|---|
| `status/in-progress` | 작업 중 |
| `status/needs-review` | 리뷰 대기 |
| `status/blocked` | 외부 의존으로 진행 불가 (본문에 막힌 원인 적기) |

**규칙**: 서로 배타적. 하나만 유지한다. 이슈가 닫히면 모두 제거.

### phase-* — 로드맵 단계 (선택이지만 권장 1개)

| 라벨 | 범위 |
|---|---|
| `phase-0` | 스켈레톤 셋업 |
| `phase-1` | MVP — 수집·피드·FTS·로그인·북마크 |
| `phase-1.5` | Vector 검색·메일 다이제스트·Slack 봇 |
| `phase-2` | Cloudflare+Supabase+Vercel 이사 |

## 제목 형식

```
<type>: <한국어 요약, 50자 이내>
```

type 접두어는 커밋 메시지와 동일. 이슈 라벨의 `type/*`과 일치시킨다.

**좋은 예**

```
feat: 피드 홈에 태그 필터 칩 추가
fix: RSS 파서가 published 필드 없는 글에서 터지는 문제
chore: Biome rule noExplicitAny를 error로 승격
docs: SPEC §3.3 데이터 모델에 FeaturedPost 추가
```

**나쁜 예**

```
버그 있음
수정 필요
이것저것
TODO: 나중에
```

## 본문 템플릿

타입별로 다르다. 각 템플릿의 섹션을 비우지 말고 채운다. 없으면 "해당 없음".

### feat / refactor / perf

```markdown
## 배경
(왜 이 작업이 필요한가 — SPEC 항목·사용자 문제·링크)

## 범위
- [ ] 구체 작업 1
- [ ] 구체 작업 2

## 승인 기준 (Acceptance Criteria)
- [ ] 이 조건이 참이어야 이슈가 닫힌다
- [ ] 수치가 있으면 수치로 (p95 < 500ms 같은)

## 범위 밖
- 하지 않기로 한 일 (나중에 별도 이슈로)

## 참고
- SPEC §N, 레퍼런스 링크, 관련 이슈 #N
```

### fix

```markdown
## 증상
(사용자/로그에서 관찰된 행동)

## 재현
1. ...
2. ...
3. 기대: X / 실제: Y

## 원인 가설
(알고 있다면. 모르면 "조사 필요")

## 승인 기준
- [ ] 재현 시나리오가 기대대로 동작
- [ ] 회귀 테스트 추가
```

### chore / docs

```markdown
## 무엇을
(바꿀 대상)

## 왜
(바꾸는 이유)

## 완료 조건
- [ ] ...
```

## 원자 이슈 (Atomic Issue)

커밋과 같은 원칙. 한 이슈는 한 가지 일.

**쪼개는 기준**

- PR로 만들 때 리뷰가 500줄을 넘을 것 같다 → 쪼개라
- scope 라벨을 3개 붙이고 싶다 → 쪼개라
- "그리고"로 제목을 잇고 싶다 → 쪼개라
- 승인 기준 체크리스트가 10개를 넘는다 → 쪼개라

**상위 이슈로 묶기**

여러 이슈를 하나의 기능이 묶는다면 **트래킹 이슈**를 만들고 본문에 `- [ ] #12 태스크` 형식으로 하위 이슈를 나열한다. 트래킹 이슈에는 해당 `phase-*`와 최상위 `scope/*` 라벨만 건다.

## gh CLI 사용법

### 단건 생성

```bash
gh issue create \
  --repo Novel-OxO/devmoa \
  --title "feat: 피드 홈에 태그 필터 칩 추가" \
  --label "type/feat,scope/web,phase-1" \
  --body "$(cat <<'EOF'
## 배경
SPEC §2.2 S2 — 태그·회사 필터링 시나리오.

## 범위
- [ ] 상단에 태그 칩 컴포넌트 추가
- [ ] URL 쿼리 `?tag=...`와 동기화
- [ ] SSR에서 초기 태그 반영

## 승인 기준
- [ ] `/tag/typescript` 접속 시 해당 태그 칩이 활성
- [ ] 칩 클릭 시 URL과 목록이 즉시 갱신

## 범위 밖
- 태그 추천(다음 이슈)
EOF
)"
```

### 여러 이슈 일괄 생성

복잡한 로드맵이라면 `gh issue create`를 쉘 루프로 돌리기보다 **먼저 제목/라벨 목록을 확정한 뒤 사람에게 확인받고** 실행한다. 잘못 만든 이슈를 닫는 것은 보드 히스토리를 어지럽힌다.

### 라벨 수정

```bash
gh issue edit <번호> --repo Novel-OxO/devmoa \
  --add-label "status/in-progress" \
  --remove-label "status/needs-review"
```

### 현재 보드 조회

```bash
gh issue list --repo Novel-OxO/devmoa --label "phase-1" --state open
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "라벨은 나중에 달면 된다" | 안 달면 보드에서 사라진다. 만드는 순간 붙인다. |
| "type이랑 scope는 title에 있으니 라벨은 생략해도 된다" | 필터는 라벨만 본다. title은 사람만 읽는다. |
| "이슈 하나에 다 묶는 게 깔끔하다" | PR 리뷰 때 쪼갠 걸 후회한다. 먼저 쪼개라. |
| "상태 라벨은 내가 기억한다" | 타인이 보드를 볼 때 기억은 공유 안 된다. `status/*`로 노출하라. |
| "승인 기준은 말로 하면 된다" | 체크박스 없는 이슈는 언제 끝났는지 아무도 모른다. |
| "P0가 아니면 우선순위는 의미 없다" | P1과 P3의 차이가 스프린트 선택을 바꾼다. |

## Red Flags

- `type/*`이나 `scope/*`이 없는 이슈
- `status/in-progress`가 2주 이상 유지되는 이슈 → 쪼개거나 블록 원인 드러내기
- 제목이 한글/영어 대소문자·접두어가 제각각
- 본문이 한 줄짜리 ("나중에 해야 함")
- 승인 기준이 없는 `type/feat`
- 재현 절차가 없는 `type/fix`
- `phase-2` 인데 `phase-1` 기능 구현이 안 끝난 이슈가 in-progress

## Verification

이슈를 만든 뒤, 닫기 전에 다음을 점검한다.

- [ ] 제목이 `<type>: <요약>` 형식이다.
- [ ] `type/*` 1개, `scope/*` 1~2개가 달려 있다.
- [ ] 해당되면 `phase-*` 1개, `priority/*` 1개가 달려 있다.
- [ ] 본문에 배경·승인 기준·범위 밖이 있다 (fix면 재현 절차).
- [ ] 체크리스트가 현실적 크기(10개 이하). 넘으면 쪼갤 것.
- [ ] 상위/하위 트래킹 이슈가 있으면 서로 링크(`#번호`)돼 있다.
- [ ] 진행하면 `status/in-progress`, 멈추면 `status/blocked`을 단다.
- [ ] 닫을 때 모든 `status/*`을 제거한다.
