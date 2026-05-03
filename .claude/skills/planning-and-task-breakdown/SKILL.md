---
name: planning-and-task-breakdown
description: 작업을 순서 있는 태스크로 분해한다. 명세나 명확한 요구사항이 있고, 구현 가능한 단위와 의존 순서를 정해야 할 때 사용한다.
---

# 계획과 작업 분해

## Overview

큰 일을 작은 일로 자르는 것이 아니라, 검증 가능한 작업 단위로 설계한다. 좋은 작업 분해는 구현 속도를 높이는 동시에, 의존 관계와 실패 지점을 초기에 드러내서 엉킨 구현을 막는다.

## When to Use

- 명세는 있는데 구현 가능한 작업 단위가 아직 없을 때
- 작업이 너무 커서 어디서 시작할지 막막할 때
- 여러 에이전트나 여러 세션으로 나눠 진행할 수 있을지 판단해야 할 때
- 사람에게 범위와 순서를 설명해야 할 때
- 구현 순서가 자명하지 않을 때

**When NOT to use:** 단일 파일 수정처럼 범위가 분명하고 분해 자체가 의미 없는 작업에는 쓰지 않는다. 명세 안에 이미 잘 정의된 task list가 있으면 중복 계획을 만들지 않는다.

## 계획 프로세스

작업 분해는 구현 전 read-only 단계에서 수행한다.

```text
SPEC / REQUIREMENTS
        │
        ├── Step 1: Plan Mode
        ├── Step 2: Dependency Graph
        ├── Step 3: Vertical Slices
        ├── Step 4: Task Writing
        └── Step 5: Ordering & Checkpoints
```

### Step 1: Plan Mode

코드를 쓰기 전에 먼저 읽고 정리한다. 이 단계의 산출물은 코드가 아니라 계획 문서다.

- 명세와 관련 코드 영역을 읽는다.
- 현재 코드베이스의 패턴과 관례를 확인한다.
- 어떤 구성요소가 어떤 것에 의존하는지 정리한다.
- 리스크와 미지수를 기록한다.

**계획 단계에서는 구현하지 않는다.** 읽기, 정리, 분해가 전부다.

### Step 2: Identify The Dependency Graph

무엇이 무엇에 의존하는지 먼저 그린다. 구현 순서는 대개 이 그래프를 거슬러 올라가며 정해진다.

```text
Database schema
    │
    ├── API models / types
    │      │
    │      ├── API endpoints
    │      │      │
    │      │      └── Frontend API client
    │      │              │
    │      │              └── UI components
    │      │
    │      └── Validation logic
    │
    └── Seed data / migrations
```

기초가 되는 층이 준비되지 않았는데 상위 기능부터 나가면, 뒤에서 되돌아오는 비용이 커진다.

### Step 3: Slice Vertically

DB만 전부 만들고, API를 전부 만들고, UI를 전부 만드는 식의 수평 분할은 피한다. 한 번에 하나의 end-to-end 경로를 완성하는 수직 분할을 기본으로 한다.

**Bad: horizontal slicing**

```text
Task 1: 데이터베이스 전체 스키마 구축
Task 2: API 전체 엔드포인트 구축
Task 3: UI 전체 컴포넌트 구축
Task 4: 전부 연결
```

**Good: vertical slicing**

```text
Task 1: 사용자가 계정을 생성할 수 있다 (schema + API + UI)
Task 2: 사용자가 로그인할 수 있다 (auth schema + API + UI)
Task 3: 사용자가 태스크를 생성할 수 있다 (task schema + API + UI)
Task 4: 사용자가 태스크 목록을 볼 수 있다 (query + API + UI)
```

각 task는 스스로 동작하고 검증할 수 있는 얇은 기능 단위여야 한다.

### Step 4: Write Tasks

각 task는 아래 형식을 따른다.

```markdown
## Task [N]: [짧고 설명적인 제목]

**Description:**
[이 task가 무엇을 달성하는지 한 문단으로 설명]

**Acceptance criteria:**
- [ ] [구체적이고 테스트 가능한 조건]
- [ ] [구체적이고 테스트 가능한 조건]

**Verification:**
- [ ] Tests pass: `npm test -- --grep "feature-name"`
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: [무엇을 직접 확인할지]

**Dependencies:**
[선행 task 번호 또는 "None"]

**Files likely touched:**
- `src/path/to/file.ts`
- `tests/path/to/test.ts`

**Estimated scope:**
[XS | S | M | L | XL]
```

task는 제목만 있어서는 안 된다. 완료 조건과 검증 방법이 같이 있어야 한다.

### Step 5: Order And Checkpoint

task를 나열한 다음에는 순서를 조정하고, 중간 checkpoint를 둔다.

정렬 기준은 아래와 같다.

1. 의존 관계가 먼저 충족되어야 한다.
2. 각 task 뒤에도 시스템은 가능한 한 동작 가능한 상태를 유지해야 한다.
3. 2~3개 task마다 checkpoint를 둔다.
4. 위험이 큰 작업은 초기에 배치해서 빨리 실패하게 한다.

checkpoint는 명시적으로 적는다.

```markdown
## Checkpoint: After Tasks 1-3
- [ ] All tests pass
- [ ] Application builds without errors
- [ ] Core user flow works end-to-end
- [ ] Review with human before proceeding
```

## Task Sizing Guidelines

에이전트가 가장 잘하는 크기는 `S`와 `M`이다. `L` 이상이 나오면 대개 더 쪼개야 한다.

| Size | Files | Scope | Example |
|---|---|---|---|
| XS | 1 | 단일 함수나 설정 변경 | 검증 규칙 하나 추가 |
| S | 1-2 | 하나의 컴포넌트나 엔드포인트 | API 엔드포인트 하나 추가 |
| M | 3-5 | 기능 슬라이스 하나 | 사용자 가입 플로우 |
| L | 5-8 | 여러 컴포넌트가 걸친 기능 | 검색 + 필터 + 페이지네이션 |
| XL | 8+ | 너무 큼. 더 쪼개야 함 | — |

다음 중 하나라도 해당하면 더 쪼갠다.

- 한 번의 집중 세션으로 끝나지 않을 것 같을 때
- 승인 기준을 3개 이내의 bullet로 설명하기 어려울 때
- 서로 독립적인 두 서브시스템 이상을 동시에 건드릴 때
- task 제목에 "그리고"가 들어갈 때

## 구현 계획 문서 템플릿

```markdown
# Implementation Plan: [Feature/Project Name]

## Overview
[무엇을 만드는지 한 문단 요약]

## Architecture Decisions
- [핵심 결정 1과 이유]
- [핵심 결정 2과 이유]

## Task List

### Phase 1: Foundation
- [ ] Task 1: ...
- [ ] Task 2: ...

### Checkpoint: Foundation
- [ ] Tests pass, builds clean

### Phase 2: Core Features
- [ ] Task 3: ...
- [ ] Task 4: ...

### Checkpoint: Core Features
- [ ] End-to-end flow works

### Phase 3: Polish
- [ ] Task 5: ...
- [ ] Task 6: ...

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review

## Risks And Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| [Risk] | [High/Med/Low] | [Strategy] |

## Open Questions
- [사람 입력이 필요한 항목]
```

## 병렬화 판단법

여러 에이전트나 여러 세션으로 나눌 수 있는지 판단할 때는 아래 기준을 쓴다.

**Safe to parallelize**

- 서로 독립적인 기능 슬라이스
- 이미 구현된 기능의 테스트 추가
- 문서화 작업

**Must be sequential**

- 데이터베이스 마이그레이션
- shared state 변경
- 명확한 의존 체인이 있는 작업

**Needs coordination**

- 같은 API contract를 공유하는 작업
- 공통 타입 정의를 함께 쓰는 작업
- 서로 같은 핵심 파일을 수정하는 작업

이 경우에는 계약을 먼저 고정한 뒤 병렬화한다.

## 계획에서 자주 놓치는 것

- 리스크를 task 뒤가 아니라 계획 앞단에 두는 것
- verification이 없는 task를 허용하지 않는 것
- "나중에 정리" 같은 정체불명 후속 작업을 남기지 않는 것
- 사람이 중간 checkpoint에서 방향을 확인할 기회를 넣는 것

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "하면서 정하면 된다" | 그 방식은 대개 의존 관계를 놓치고 재작업을 만든다. 10분 계획이 몇 시간 구현보다 싸다. |
| "task가 뻔해서 적을 필요가 없다" | 명시적으로 적는 순간 숨은 의존성과 빠진 검증이 드러난다. |
| "계획은 오버헤드다" | 구현 없이 타이핑만 하는 것도 낭비지만, 계획 없는 구현은 더 큰 낭비다. |
| "다 머릿속에 있다" | 세션은 끊기고 문맥은 압축된다. 적어 둔 계획만이 경계를 넘겨도 살아남는다. |
| "큰 task 하나가 더 효율적이다" | 큰 task는 검증과 리뷰를 어렵게 만든다. 작고 동작 가능한 단위가 더 빠르다. |

## Red Flags

- task list 없이 바로 구현을 시작하는 상태
- 승인 기준 없이 "기능 구현" 같은 task만 적혀 있는 상태
- verification이 비어 있는 계획
- 대부분의 task가 `L` 또는 `XL`인 상태
- checkpoint가 없는 계획
- 의존 관계보다 개인 취향으로 순서를 잡는 상태

## Verification

구현을 시작하기 전에 다음을 확인한다.

- [ ] 모든 task에 acceptance criteria가 있다.
- [ ] 모든 task에 verification step이 있다.
- [ ] task 의존 관계가 식별되고 올바른 순서로 정렬되어 있다.
- [ ] 어떤 task도 대략 5개 이상의 파일을 무심코 건드리게 설계되지 않았다.
- [ ] 주요 phase 사이에 checkpoint가 있다.
- [ ] 사람이 계획을 검토하고 승인할 수 있는 형태로 정리되어 있다.
