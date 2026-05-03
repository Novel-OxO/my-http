---
name: code-simplification
description: 동작을 바꾸지 않고 코드를 더 명확하게 만든다. 구현은 맞지만 읽기, 수정, 리뷰가 불필요하게 어려울 때 복잡도를 줄이기 위해 사용한다.
---

# 코드 단순화

## Overview

코드 단순화의 목적은 줄 수를 줄이는 것이 아니라, **동작을 그대로 유지한 채 이해 비용을 낮추는 것**이다. 좋은 단순화는 새 팀원이 더 빨리 읽고, 더 안전하게 수정하고, 더 쉽게 디버깅할 수 있게 만든다.

모든 단순화는 이 질문을 통과해야 한다.

```text
"새 팀원이 원래 코드보다 이 버전을 더 빨리 이해할 수 있는가?"
```

## When to Use

- 기능은 동작하지만 구현이 필요 이상으로 무거울 때
- 코드 리뷰에서 가독성, 복잡도, 일관성 문제가 지적됐을 때
- 깊은 중첩, 긴 함수, 모호한 이름을 만났을 때
- 시간 압박 속에서 작성된 코드를 다시 정리할 때
- 파일 여기저기에 흩어진 관련 로직을 더 선명하게 정리할 때
- 방금 머지된 변경이 중복이나 불일치를 남겼을 때

**When NOT to use:**

- 이미 충분히 명확한 코드를 억지로 더 손보는 경우
- 아직 코드가 무엇을 하는지 이해하지 못한 경우
- 성능 핵심 구간인데 "더 단순한" 버전이 측정 가능한 성능 저하를 만드는 경우
- 곧 모듈 전체를 갈아엎을 예정이라 정리 비용이 낭비되는 경우

## The Five Principles

### 1. Preserve Behavior Exactly

동작은 바꾸지 않는다. 입력, 출력, 부작용, 에러 동작, edge case가 모두 동일해야 한다.

매 변경 전 질문:

- 모든 입력에 대해 같은 출력을 내는가?
- 같은 에러 동작을 유지하는가?
- side effect와 그 순서가 같은가?
- 기존 테스트가 수정 없이 통과하는가?

조금이라도 확신이 없으면, 그 단순화는 하지 않는다.

### 2. Follow Project Conventions

단순화는 개인 취향을 밀어넣는 작업이 아니다. 코드베이스에 더 일관되게 만드는 작업이다.

단순화 전 확인:

1. `AGENTS.md`와 프로젝트 규칙 읽기
2. 인접 코드가 비슷한 문제를 어떻게 푸는지 보기
3. 아래 항목에서 기존 스타일 맞추기

- import ordering
- 함수 선언 스타일
- naming convention
- error handling
- type annotation depth

코드베이스 일관성을 깨는 "정리"는 단순화가 아니라 churn이다.

### 3. Prefer Clarity Over Cleverness

짧다고 단순한 게 아니다. 읽는 사람이 멈춰서 해석해야 하면 이미 복잡하다.

```typescript
// UNCLEAR
const label = isNew ? 'New' : isUpdated ? 'Updated' : isArchived ? 'Archived' : 'Active';

// CLEAR
function getStatusLabel(item: Item): string {
  if (item.isNew) return 'New';
  if (item.isUpdated) return 'Updated';
  if (item.isArchived) return 'Archived';
  return 'Active';
}
```

```typescript
// UNCLEAR
const result = items.reduce((acc, item) => ({
  ...acc,
  [item.id]: {
    ...acc[item.id],
    count: (acc[item.id]?.count ?? 0) + 1,
  },
}), {});

// CLEAR
const countById = new Map<string, number>();

for (const item of items) {
  countById.set(item.id, (countById.get(item.id) ?? 0) + 1);
}
```

### 4. Maintain Balance

과도한 단순화도 실패 모드다.

주의할 함정:

- helper를 너무 공격적으로 inline해서 개념 이름을 잃는 경우
- 서로 다른 책임의 함수를 합쳐서 더 복잡한 함수 하나를 만드는 경우
- testability나 extensibility 때문에 존재하는 추상화를 무조건 없애는 경우
- line count만 줄이는 것을 목표로 삼는 경우

### 5. Scope To What Changed

기본값은 최근에 바뀐 코드 범위 안에서만 단순화하는 것이다.

하지 말 것:

- 요청하지 않은 drive-by refactor
- unrelated file까지 퍼지는 스타일 변경
- 이번 task 범위 밖 코드 정리

범위 없는 단순화는 diff를 시끄럽게 만들고, 회귀 위험을 늘린다.

## The Simplification Process

### Step 1: Understand Before Touching (Chesterton's Fence)

없애거나 바꾸기 전에, 왜 이 코드가 존재하는지 이해한다.

질문:

- 이 코드의 책임은 무엇인가?
- 누가 이걸 호출하고, 이건 무엇을 호출하는가?
- edge case와 error path는 무엇인가?
- 기대 동작을 정의하는 테스트가 있는가?
- 왜 이렇게 쓰였을 가능성이 있는가?
  - 성능?
  - 플랫폼 제약?
  - 과거 버그 대응?
  - 점진적 전환 중 흔적?

답하지 못하면, 아직 단순화할 준비가 안 된 것이다. 더 읽는다.

### Step 2: Identify Simplification Opportunities

아래 패턴은 막연한 "냄새"가 아니라 구체적인 신호다.

#### Structural Complexity

| Pattern | Signal | Simplification |
|---|---|---|
| 3단계 이상 깊은 중첩 | 흐름 추적이 어렵다 | guard clause, helper 함수 |
| 50줄 이상 긴 함수 | 책임이 여러 개다 | 이름 있는 작은 함수로 분리 |
| nested ternary | 머릿속 스택이 필요하다 | `if/else`, `switch`, lookup |
| boolean flag parameter | `doThing(true, false, true)` | options object 또는 함수 분리 |
| 반복 조건문 | 같은 `if`가 여기저기 있다 | 잘 이름 붙은 predicate 추출 |

#### Naming And Readability

| Pattern | Signal | Simplification |
|---|---|---|
| `data`, `temp`, `result` | 의미가 없다 | 실제 역할을 드러내는 이름 |
| `usr`, `cfg`, `btn` | 과한 축약 | 널리 알려진 약어 외엔 풀어쓰기 |
| misleading name | 이름과 실제 동작이 다르다 | 동작에 맞는 이름으로 수정 |
| "what" 주석 | 코드 자체로 충분히 보인다 | 주석 삭제 |
| "why" 주석 | 의도와 제약을 담고 있다 | 유지 |

#### Redundancy

| Pattern | Signal | Simplification |
|---|---|---|
| duplicated logic | 5줄 이상이 반복 | 공용 함수 추출 |
| dead code | 도달되지 않음 | 진짜 죽은 코드 확인 후 제거 |
| wrapper with no value | 그냥 한 단계 더 감쌈 | wrapper 제거 |
| over-engineered pattern | factory-for-a-factory | 직접적 접근으로 교체 |
| redundant type assertion | 이미 추론 가능한 타입 | assertion 제거 |

### Step 3: Apply Changes Incrementally

한 번에 하나씩 바꾼다. 매 단순화 뒤에는 테스트를 돌린다.

```text
FOR EACH SIMPLIFICATION:
1. 변경
2. 테스트
3. 통과 → 다음 변경
4. 실패 → 즉시 되돌리고 재평가
```

기능 변경과 리팩터링은 분리한다. 같은 PR이나 같은 커밋에 섞지 않는다.

### The Rule Of 500

500줄 이상을 손대는 리팩터링이면 수작업보다 automation을 먼저 검토한다.

- codemod
- `sed`
- AST transform

이 규모를 손으로 만지면 실수와 리뷰 피로가 같이 커진다.

### Step 4: Verify The Result

마지막에는 전체를 한 번 더 비교한다.

- 진짜 더 이해하기 쉬워졌는가?
- 새로 도입한 패턴이 코드베이스와 어긋나지 않는가?
- diff가 깨끗하고 리뷰 가능한가?
- 팀 동료나 리뷰 에이전트가 이걸 순이익으로 볼 것 같은가?

단순화했는데 더 읽기 어려워졌다면 되돌린다. 모든 단순화 시도가 성공하는 것은 아니다.

## Language-Specific Guidance

### TypeScript / JavaScript

```typescript
// Before
async function getUser(id: string): Promise<User> {
  return await userService.findById(id);
}

// After
function getUser(id: string): Promise<User> {
  return userService.findById(id);
}
```

```typescript
// Before
let displayName: string;
if (user.nickname) {
  displayName = user.nickname;
} else {
  displayName = user.fullName;
}

// After
const displayName = user.nickname || user.fullName;
```

```typescript
// Before
function isValid(input: string): boolean {
  if (input.length > 0 && input.length < 100) {
    return true;
  }
  return false;
}

// After
function isValid(input: string): boolean {
  return input.length > 0 && input.length < 100;
}
```

### React / JSX

prop drilling이나 abstraction은 자동 리팩터링 대상이 아니다. "이게 진짜 더 단순해지는가?"를 먼저 따진다.

```tsx
// Before
function UserBadge({ user }: Props) {
  if (user.isAdmin) {
    return <Badge variant="admin">Admin</Badge>;
  } else {
    return <Badge variant="default">User</Badge>;
  }
}

// After
function UserBadge({ user }: Props) {
  const variant = user.isAdmin ? 'admin' : 'default';
  const label = user.isAdmin ? 'Admin' : 'User';
  return <Badge variant={variant}>{label}</Badge>;
}
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "동작하니까 굳이 안 만져도 된다" | 읽기 어려운 코드는 나중에 깨졌을 때 더 비싸게 고친다. |
| "줄 수가 적을수록 단순하다" | 1줄짜리 nested ternary는 5줄짜리 `if/else`보다 더 복잡할 수 있다. |
| "이 unrelated 코드도 잠깐 같이 정리하자" | 범위 없는 단순화는 noisy diff와 회귀를 만든다. |
| "타입이 있으니 self-documenting이다" | 타입은 구조를 설명하지, 의도까지 설명하지는 않는다. |
| "이 추상화는 나중에 필요할지도 모른다" | 지금 쓰이지 않는 추상화는 복잡도만 만든다. |
| "원래 작성자가 이유가 있었겠지" | 그럴 수도 있다. 그래서 먼저 이해한다. 하지만 iteration의 찌꺼기일 수도 있다. |
| "기능 추가하면서 같이 정리하면 효율적이다" | 기능과 리팩터링을 섞으면 리뷰, 롤백, 히스토리 해석이 어려워진다. |

## Red Flags

- 테스트를 수정해야만 통과하는 "단순화"
- 단순화 후 코드가 더 길고 더 읽기 어려운 상태
- 프로젝트 관례가 아니라 개인 취향에 맞춘 rename
- "코드가 깔끔해 보이게" 하려고 error handling 제거
- 완전히 이해하지 못한 코드를 건드리는 행동
- 여러 단순화를 큰 커밋 하나에 몰아넣는 습관
- 요청 없는 범위 밖 코드까지 refactor하는 행동

## Verification

단순화 작업을 마친 뒤에는 다음을 확인한다.

- [ ] 기존 테스트가 수정 없이 모두 통과한다.
- [ ] 빌드가 성공하고 새 warning이 생기지 않는다.
- [ ] linter/formatter가 통과한다.
- [ ] 각 단순화가 리뷰 가능한 incremental change다.
- [ ] diff에 unrelated change가 섞이지 않았다.
- [ ] 단순화 후 코드가 프로젝트 관례를 따른다.
- [ ] error handling이 제거되거나 약화되지 않았다.
- [ ] dead code가 남아 있지 않다.
- [ ] 리뷰어가 순이익으로 볼 만한 정리다.
