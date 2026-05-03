---
name: incremental-implementation
description: 변경을 점진적으로 구현한다. 여러 파일에 걸친 기능이나 큰 변경을 한 번에 밀어 넣고 싶어질 때, 얇은 단위로 나눠 안전하게 진행해야 할 때 사용한다.
---

# 점진적 구현

## Overview

기능 전체를 한 번에 완성하려 하지 말고, 얇은 vertical slice를 하나씩 구현하고 검증하면서 확장한다. 좋은 점진적 구현은 속도를 늦추는 절차가 아니라, 큰 기능을 깨지지 않는 상태로 계속 전진하게 만드는 실행 규율이다.

각 increment는 언제나 동작 가능하고, 테스트 가능하며, 되돌릴 수 있는 상태를 남겨야 한다.

## When to Use

- 여러 파일에 걸치는 기능을 구현할 때
- task breakdown에서 정의한 기능 슬라이스를 순서대로 만들 때
- 기존 코드를 리팩터링할 때
- 100줄 이상을 테스트 없이 한 번에 쓰고 싶어질 때
- 위험이 큰 변경을 작게 쪼개서 안전하게 머지해야 할 때

**When NOT to use:** 범위가 이미 최소인 단일 파일, 단일 함수 수정에는 과한 절차일 수 있다.

## Increment Cycle

```text
┌──────────────────────────────────────┐
│                                      │
│  Implement ──→ Test ──→ Verify ──┐   │
│      ▲                           │   │
│      └───── Commit ◄─────────────┘   │
│                                      │
│              ▼                       │
│          Next slice                  │
│                                      │
└──────────────────────────────────────┘
```

각 slice마다 다음을 수행한다.

1. **Implement**: 가장 작은 완전 기능 단위를 구현한다.
2. **Test**: 테스트를 실행한다. 테스트가 없다면 해당 slice를 증명하는 테스트를 추가한다.
3. **Verify**: 빌드, 타입체크, 수동 확인까지 포함해 실제로 동작하는지 본다.
4. **Commit**: 설명적인 메시지로 현재 상태를 저장한다. 원자적 커밋 기준은 `git-workflow-and-versioning`을 따른다.
5. **Move to the next slice**: 이전 slice를 버리지 않고 그 위에서 확장한다.

## Slicing Strategies

### Vertical Slices (Preferred)

한 slice 안에서 스택의 한 경로를 끝까지 통과하게 만든다.

```text
Slice 1: 태스크 생성 (DB + API + 최소 UI)
→ 테스트 통과, 사용자가 실제로 생성 가능

Slice 2: 태스크 목록 조회 (query + API + UI)
→ 테스트 통과, 생성한 태스크를 볼 수 있음

Slice 3: 태스크 수정 (update + API + UI)
→ 테스트 통과, 사용자가 수정 가능

Slice 4: 태스크 삭제 (delete + API + UI + confirmation)
→ 테스트 통과, CRUD 완료
```

각 slice는 자체로 끝까지 동작해야 한다.

### Contract-First Slicing

백엔드와 프런트엔드가 동시에 움직여야 할 때는 계약부터 고정한다.

```text
Slice 0: API contract 정의 (types, interfaces, spec)
Slice 1a: contract 기준 백엔드 구현 + API 테스트
Slice 1b: 같은 contract 기준 프런트엔드 구현 + mock data
Slice 2: 실제 통합 + end-to-end 검증
```

### Risk-First Slicing

불확실성이 큰 부분을 가장 먼저 입증한다.

```text
Slice 1: WebSocket 연결이 실제로 붙는지 증명
Slice 2: 그 연결 위에 실시간 업데이트 구현
Slice 3: 오프라인/재연결 처리 추가
```

가장 위험한 가정이 초기에 깨지면, 나머지 투자를 막을 수 있다.

## Implementation Rules

### Rule 0: Simplicity First

코드를 쓰기 전과 후에 항상 묻는다.

- 이걸 더 적은 줄로 할 수 없는가?
- 이 추상화는 지금 정말 필요한가?
- 스태프 엔지니어가 보고 "그냥 이렇게 하면 되잖아?"라고 말하지 않을까?
- 현재 task가 아니라 가상의 미래 요구사항에 맞춰 설계하고 있지는 않은가?

```text
SIMPLICITY CHECK

✗ 알림 하나를 위해 middleware pipeline이 달린 범용 EventBus
✓ 단순 함수 호출

✗ 비슷한 폼 3개를 위해 config-driven form builder
✓ 공용 유틸만 공유하는 폼 3개
```

먼저 순진하지만 명백히 맞는 버전을 구현한다. 최적화는 테스트로 정확성이 증명된 뒤에 한다.

### Rule 0.5: Scope Discipline

task가 요구하는 범위만 건드린다.

다음은 하지 않는다.

- 인접 코드 "정리"
- 수정하지 않는 파일의 import 스타일 변경
- 확실히 이해하지 못한 주석 제거
- 명세에 없는 기능 추가
- 읽기만 하는 파일의 문법 현대화

범위 밖 개선점을 발견하면 기록만 한다.

```text
NOTICED BUT NOT TOUCHING:
- src/utils/format.ts unused import
- auth middleware error message 개선 여지
→ 원하면 별도 task로 분리
```

### Rule 1: One Thing At A Time

각 increment는 논리적으로 하나의 변화만 포함한다.

**Bad:** 새 컴포넌트 추가 + 기존 컴포넌트 리팩터링 + 빌드 설정 변경  
**Good:** 세 개의 작은 increment로 분리

### Rule 2: Keep It Compilable

각 increment 뒤에는 프로젝트가 다시 빌드되고, 기존 테스트가 통과해야 한다. 중간 상태가 깨져 있으면 다음 slice의 디버깅 비용이 폭증한다.

### Rule 3: Feature Flags For Incomplete Features

increment를 mainline에 병합해야 하지만 기능이 아직 사용자에게 보여선 안 된다면 flag로 감싼다.

```typescript
const ENABLE_TASK_SHARING = process.env.FEATURE_TASK_SHARING === 'true';

if (ENABLE_TASK_SHARING) {
  // 새 공유 UI
}
```

### Rule 4: Safe Defaults

새 기능은 보수적인 기본값을 가져야 한다.

```typescript
export function createTask(data: TaskInput, options?: { notify?: boolean }) {
  const shouldNotify = options?.notify ?? false;
  // ...
}
```

### Rule 5: Rollback-Friendly

각 increment는 독립적으로 되돌릴 수 있어야 한다.

- additive change를 선호한다.
- 기존 코드 수정은 최소 범위로 제한한다.
- migration에는 rollback 경로를 함께 생각한다.
- 삭제와 대체를 한 commit에 섞지 않는다.

## Working With Agents

에이전트에게 점진적 구현을 지시할 때는, 이번 increment의 범위와 비범위를 선명하게 제한한다.

```text
"계획의 Task 3을 구현하자.
이번 increment에서는 데이터 스키마와 API endpoint까지만 다룬다.
UI는 건드리지 않는다.
구현 후 `npm test`와 `npm run build`로 검증한다."
```

작업이 크다고 느껴질수록, "이번 increment에서 하지 않는 것"을 더 구체적으로 적어야 한다.

## Increment Checklist

각 increment 뒤에는 다음을 확인한다.

- [ ] 변경이 하나의 논리적 일을 완전히 끝낸다.
- [ ] 기존 테스트가 계속 통과한다.
- [ ] 빌드가 성공한다.
- [ ] 타입체크가 통과한다.
- [ ] lint가 통과한다.
- [ ] 새 기능이 의도대로 동작한다.
- [ ] 설명적인 메시지로 커밋됐다.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "마지막에 한 번에 테스트하면 된다" | Slice 1의 버그가 Slice 2~5에 전파되면, 어디서 깨졌는지 찾는 비용이 급증한다. |
| "한 번에 다 만드는 게 더 빠르다" | 500줄 바꾼 뒤 어디서 깨졌는지 찾는 시간까지 포함하면 대개 더 느리다. |
| "이건 너무 작아서 따로 커밋할 필요 없다" | 작은 커밋은 공짜에 가깝고, 큰 커밋은 롤백과 리뷰 비용을 키운다. |
| "feature flag는 나중에 붙이면 된다" | 미완성 기능이 사용자에게 노출되면 이미 늦다. 필요하면 지금 넣어야 한다. |
| "이 리팩터링 정도는 같이 넣어도 된다" | 기능과 리팩터링을 섞으면 둘 다 리뷰와 디버깅이 어려워진다. |

## Red Flags

- 테스트 없이 100줄 이상 작성한 상태
- 하나의 increment에 unrelated change가 여러 개 섞인 상태
- "이것도 그냥 같이 하자" 식 범위 확장
- test/verify 단계를 건너뛰는 습관
- increment 사이에 build나 tests가 깨진 상태
- 커밋되지 않은 큰 변경이 쌓이는 상태
- 세 번째 사용 사례도 없는데 추상화를 먼저 만드는 태도
- task 범위 밖 파일을 "온 김에" 건드리는 행동

## Verification

task의 모든 increment를 마친 뒤에는 다음을 확인한다.

- [ ] 각 increment가 개별적으로 테스트되고 저장됐다.
- [ ] 전체 테스트 스위트가 통과한다.
- [ ] 빌드가 깨끗하다.
- [ ] 기능이 명세대로 end-to-end로 동작한다.
- [ ] 설명 없이 방치된 큰 미커밋 변경이 없다.
