---
name: documentation-and-adrs
description: 결정과 문서를 기록한다. 아키텍처 결정을 내릴 때, 공개 API를 바꿀 때, 기능 출시 맥락을 남겨야 할 때, 미래의 엔지니어와 에이전트가 이해해야 할 이유와 제약을 문서화해야 할 때 사용한다.
---

# 문서화와 ADR

## Overview

코드만 남기지 말고 결정도 남긴다. 가장 가치 있는 문서는 구현 결과보다, 왜 이렇게 만들었는지와 어떤 제약과 trade-off가 있었는지를 기록한다.

코드는 무엇을 만들었는지 보여준다. 문서는 왜 그렇게 만들었는지와 어떤 대안을 버렸는지 설명한다. 이 문맥이 없으면 미래의 사람과 에이전트는 같은 논의를 반복하게 된다.

## When to Use

- 중요한 아키텍처 결정을 내릴 때
- 경쟁하는 접근 방식 중 하나를 선택할 때
- 공개 API를 추가하거나 바꿀 때
- 사용자 체감 동작이 바뀌는 기능을 출시할 때
- 새 팀원이나 에이전트를 프로젝트에 온보딩할 때
- 같은 설명을 반복하고 있다는 신호가 보일 때

**When NOT to use:** 코드가 이미 자명한 내용을 다시 적지 않는다. 코드가 말해 주는 `what`를 주석으로 반복하지 않는다. 버려질 프로토타입을 위해 과한 문서를 만들지 않는다.

## ADR 작성 규율

ADR은 중요한 기술 결정을 왜 그렇게 내렸는지 기록한다. 작성 비용 대비 가치가 가장 높은 문서다.

### 언제 ADR을 쓰는가

- framework, library, major dependency를 선택할 때
- 데이터 모델이나 데이터베이스 스키마를 설계할 때
- 인증/인가 전략을 정할 때
- API 아키텍처를 선택할 때
- build tool, hosting platform, infrastructure를 고를 때
- 되돌리기 비용이 큰 결정을 할 때

### ADR 템플릿

ADR은 `docs/decisions/` 아래에 순번으로 저장한다.

```markdown
# ADR-001: 주 데이터베이스로 PostgreSQL 사용

## Status
Accepted | Superseded by ADR-XXX | Deprecated

## Date
2026-04-07

## Context
태스크 관리 애플리케이션의 주 데이터베이스가 필요하다.

핵심 요구사항:
- 관계형 데이터 모델
- 태스크 상태 변경에 대한 ACID 트랜잭션
- 본문 검색 지원
- 작은 팀이 운영 가능한 managed hosting

## Decision
Prisma ORM과 함께 PostgreSQL을 사용한다.

## Alternatives Considered

### MongoDB
- 장점: 스키마가 유연하고 시작이 빠르다
- 단점: 현재 데이터는 본질적으로 관계형이다
- 기각 이유: 관계를 문서 저장소에 억지로 맞추면 복잡도만 늘어난다

### SQLite
- 장점: 설정이 거의 없고 로컬 개발이 쉽다
- 단점: 동시 쓰기와 운영 환경 확장성이 제한된다
- 기각 이유: 멀티 유저 운영 환경에는 맞지 않는다

### MySQL
- 장점: 성숙하고 널리 쓰인다
- 단점: 현재 요구사항에서는 PostgreSQL 쪽 ecosystem fit이 더 낫다
- 기각 이유: 검색과 JSON 지원, 도구 호환성이 PostgreSQL 쪽이 유리하다

## Consequences
- Prisma migration workflow를 표준으로 삼는다
- PostgreSQL 운영 지식이 팀 기본 역량에 포함된다
- full-text search를 별도 검색 엔진 없이 우선 해결할 수 있다
```

### ADR Lifecycle

```text
PROPOSED → ACCEPTED → (SUPERSEDED or DEPRECATED)
```

- 예전 ADR을 지우지 않는다. 역사적 맥락 자체가 자산이다.
- 결정이 바뀌면 기존 ADR을 수정해서 덮지 말고, 새 ADR을 써서 supersede 관계를 남긴다.

## 인라인 문서화

### 언제 주석을 쓰는가

주석은 `what`가 아니라 `why`를 설명한다.

```typescript
// BAD: 코드가 이미 말하는 내용을 반복
counter += 1;

// GOOD: 비자명한 의도를 설명
// rate limit은 sliding window를 사용한다.
// 고정 주기로 리셋하면 window 경계에서 burst가 생긴다.
if (now - windowStart > WINDOW_SIZE_MS) {
  counter = 0;
  windowStart = now;
}
```

### 언제 주석을 쓰지 않는가

```typescript
// 자명한 코드는 설명하지 않는다.
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// TODO로 미루지 말고 지금 해야 할 일은 지금 한다.
// TODO: 에러 처리 추가

// 주석 처리된 옛 코드는 남기지 않는다.
// const oldImplementation = () => {}
```

주석 처리된 코드는 지운다. Git이 히스토리를 보존한다.

### Known Gotcha 문서화

재현이 까다롭거나, 호출 순서가 중요하거나, SSR/CSR 경계처럼 함정이 있는 코드는 그 지점 바로 옆에 문서화한다.

```typescript
/**
 * IMPORTANT: 첫 렌더 전에 호출해야 한다.
 * hydration 이후에 호출하면 SSR 시점의 theme 정보와 어긋나
 * flash of unstyled content가 발생한다.
 *
 * 전체 설계 이유는 ADR-003을 참고한다.
 */
export function initializeTheme(theme: Theme): void {
  // ...
}
```

## API 문서화

공개 API는 타입만으로 끝내지 않는다. 입력, 출력, 실패 조건을 문서화한다.

### 타입 옆에서 문서화하기

TypeScript라면 declaration 근처에 JSDoc을 두는 방식이 기본값이다.

```typescript
/**
 * 새 태스크를 만든다.
 *
 * @param input - 제목은 필수이고 설명은 선택인 생성 입력
 * @returns 서버가 생성한 ID와 타임스탬프를 포함한 태스크
 * @throws {ValidationError} 제목이 비었거나 200자를 넘기면 발생
 * @throws {AuthenticationError} 인증되지 않은 요청이면 발생
 *
 * @example
 * const task = await createTask({ title: '장보기' });
 * console.log(task.id);
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  // ...
}
```

### REST API 문서

REST surface가 있으면 OpenAPI/Swagger처럼 기계적으로 검증 가능한 형식을 유지한다.

```yaml
paths:
  /api/tasks:
    post:
      summary: 태스크 생성
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTaskInput'
      responses:
        '201':
          description: 생성 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Task'
        '422':
          description: 입력 검증 실패
```

## README 구조

모든 프로젝트 README는 최소한 아래를 포함해야 한다.

```markdown
# Project Name

이 프로젝트가 무엇을 하는지 한 문단으로 설명한다.

## Quick Start
1. 저장소 clone
2. 의존성 설치: `npm install`
3. 환경 변수 준비: `cp .env.example .env`
4. 개발 서버 실행: `npm run dev`

## Commands
| Command | Description |
|---|---|
| `npm run dev` | 개발 서버 실행 |
| `npm test` | 테스트 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | 린트 실행 |

## Architecture
프로젝트 구조와 핵심 설계 결정을 짧게 설명한다.
상세 이유는 ADR 링크로 연결한다.

## Contributing
기여 방식, 코딩 규약, PR 절차를 적는다.
```

README는 설치 방법만 적는 문서가 아니다. "이 프로젝트는 어떤 구조와 규율로 돌아가는가"까지 보여줘야 한다.

## 변경 이력 유지

출시된 기능은 changelog에도 흔적을 남긴다.

```markdown
# Changelog

## [1.2.0] - 2026-04-07

### Added
- 태스크 공유 기능 추가 (#123)
- 담당자 알림 이메일 추가 (#124)

### Fixed
- 빠른 연속 클릭 시 중복 태스크가 생성되던 문제 수정 (#125)

### Changed
- 태스크 목록 기본 페이지 크기를 20에서 50으로 변경 (#126)
```

릴리스 노트는 마케팅 문장이 아니라 운영 기록이다. 무엇이 추가됐고, 무엇이 바뀌었고, 어떤 영향이 있는지 빠르게 읽혀야 한다.

## 에이전트를 위한 문서화

에이전트는 코드만 읽지 않는다. 규칙 파일과 명세, ADR도 읽는다. 그래서 아래 문서는 항상 최신이어야 한다.

- `AGENTS.md` 같은 규칙 파일: 프로젝트 관례와 금지 사항
- `spec-driven-development` 산출물: 지금 무엇을 만들고 있는지
- ADR: 이미 내려진 결정을 다시 토론하지 않게 하는 근거
- 인라인 gotcha 문서: 알려진 함정 재발 방지

같은 설명을 PR 코멘트나 채팅에서 반복하고 있다면, 문서화할 위치를 잘못 잡고 있다는 신호다.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "코드가 self-documenting이다" | 코드는 `what`를 보여주지만 `why`, 버린 대안, 제약 조건은 보여주지 않는다. |
| "API가 안정되면 나중에 문서 쓰자" | 문서를 써 보면 설계의 빈틈이 먼저 드러난다. 문서가 설계의 첫 테스트다. |
| "아무도 문서를 안 읽는다" | 미래의 엔지니어와 에이전트, 몇 달 뒤의 너 자신이 읽는다. |
| "ADR은 오버헤드다" | 10분짜리 ADR 하나가 몇 달 뒤 2시간짜리 재논의를 막는다. |
| "주석은 어차피 낡는다" | `why`를 설명하는 주석은 비교적 안정적이다. `what`를 반복하는 주석이 빨리 낡는다. |

## Red Flags

- 중요한 아키텍처 결정에 서면 근거가 없다
- 공개 API에 타입이나 문서가 없다
- README가 실행 방법을 설명하지 못한다
- 주석 처리된 코드가 남아 있다
- 몇 주째 방치된 TODO가 남아 있다
- 중요한 설계 선택이 많은데 ADR이 없다
- 코드 설명만 반복하고 의도와 제약을 설명하지 못하는 문서가 많다

## Verification

문서화 후 아래를 확인한다.

- [ ] 중요한 아키텍처 결정마다 ADR이 존재한다
- [ ] README가 quick start, commands, architecture overview를 포함한다
- [ ] 공개 API에 입력, 출력, 실패 조건 문서가 있다
- [ ] known gotcha가 실제 문제 지점 가까이에 문서화돼 있다
- [ ] 주석 처리된 코드가 남아 있지 않다
- [ ] `AGENTS.md`, spec, ADR 등 에이전트가 읽는 문서가 현재 코드와 일치한다
