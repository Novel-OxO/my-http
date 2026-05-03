---
name: frontend-ui-engineering
description: 프로덕션급 UI를 설계하고 구현한다. 화면, 컴포넌트, 상태 흐름, 상호작용, 접근성까지 포함한 프런트엔드 작업을 만들거나 수정할 때 사용한다.
---

# 프런트엔드 UI 엔지니어링

## Overview

화면을 그리는 것만으로는 충분하지 않다. 좋은 UI 엔지니어링은 시각적 완성도, 상태 관리, 접근성, 오류 상태, 성능, 반응형 동작까지 함께 설계하는 일이다. 보기에만 맞는 화면이 아니라, 실제 사용 환경에서 안정적으로 동작하는 인터페이스를 만든다.

## When to Use

- 새 화면이나 컴포넌트를 만들 때
- 기존 화면의 구조, 상태, 상호작용을 바꿀 때
- 폼, 모달, 드롭다운, 테이블 같은 복합 UI를 구현할 때
- 로딩, 에러, 빈 상태, optimistic update를 설계할 때
- 반응형 레이아웃과 접근성 요구를 함께 만족해야 할 때

**When NOT to use:** purely backend 작업이나 UI surface가 없는 로직 변경에는 맞지 않는다. 텍스트 한 줄 수정처럼 시각적/상태적 복잡도가 없는 작업에도 과한 절차일 수 있다.

## UI Delivery Loop

```text
Structure ──→ State ──→ Interaction ──→ Accessibility ──→ Verify
    │            │             │               │                │
    └────────────┴─────────────┴───────────────┴────────────────┘
```

화면은 항상 이 순서로 생각한다.

1. **Structure**: 레이아웃과 정보 계층
2. **State**: 어떤 상태가 있고 어디서 관리되는지
3. **Interaction**: 클릭, 입력, 전환, 피드백
4. **Accessibility**: 키보드, 포커스, 의미론, 스크린리더
5. **Verify**: 실제 사용 흐름과 edge case 확인

## Build The Structure First

UI 구현은 장식보다 구조가 먼저다.

- 정보 계층을 먼저 정한다.
- 각 영역이 어떤 목적을 가지는지 나눈다.
- 주요 사용자 행동이 화면 위에서 자연스럽게 이어지는지 본다.
- 반응형 전환 시 무엇이 유지되고 무엇이 바뀌는지 정한다.

좋은 시작 방식:

```text
Page
├── Header: 제목, 주요 액션
├── Filters: 검색, 정렬, 상태 필터
├── Main Content: 리스트 또는 상세 정보
└── Secondary State: 로딩, 빈 상태, 에러
```

나쁜 시작 방식:

```text
버튼 색, hover, 그림자부터 정하고
나중에 구조를 끼워 맞춘다
```

## State Design

UI 문제의 절반은 상태 문제다. 먼저 상태를 적고, 그 다음 컴포넌트를 만든다.

질문:

- 서버 상태인가, 클라이언트 상태인가?
- 한 컴포넌트 로컬에 둘 수 있는가?
- 여러 컴포넌트가 공유해야 하는가?
- derived state를 굳이 저장하고 있지는 않은가?
- 실패했을 때 어떤 rollback이 필요한가?

기본 원칙:

- 서버 데이터는 fetching layer가 책임진다.
- 입력 중 값, 열림/닫힘, hover 같은 일시 상태는 최대한 로컬에 둔다.
- 같은 사실을 두 군데 저장하지 않는다.
- derived value는 계산하고, source of truth만 저장한다.

```tsx
// Good
const isEmpty = tasks.length === 0;

// Bad
const [isEmpty, setIsEmpty] = useState(false);
// tasks가 바뀔 때마다 sync bug 위험
```

## Design Every UI State

happy path만 만들면 실제 제품은 반쯤만 만든 것이다. 최소한 아래 상태를 설계한다.

- initial loading
- background refetch
- empty state
- validation error
- server error
- success feedback
- disabled / pending action

```text
Task List
- Loading: skeleton rows 5개
- Empty: "아직 태스크가 없습니다" + 생성 CTA
- Error: 재시도 버튼이 있는 경고 패널
- Data: 테이블 또는 카드 리스트
```

상태를 숨기지 말고, 사용자에게 지금 무슨 일이 일어나는지 보이게 한다.

## Interaction Design

각 상호작용에는 다음 네 가지가 있어야 한다.

1. trigger
2. system response
3. success outcome
4. failure outcome

예:

```text
User clicks "Save"
→ Button enters pending state
→ Form disables duplicate submit
→ Success: toast + close modal + list updates
→ Failure: inline error + button re-enabled + input preserved
```

좋은 UI는 성공 시나리오만 빠른 것이 아니라, 실패 시나리오도 복구 가능하다.

## Forms

폼은 UI 엔지니어링에서 가장 많은 버그가 나는 영역이다.

원칙:

- label은 항상 명시한다.
- placeholder를 label 대체로 쓰지 않는다.
- validation은 입력 단위와 제출 단위 모두 고려한다.
- first invalid field로 포커스를 이동시킨다.
- submit 중복을 막는다.
- 사용자가 입력한 값을 실패 시 잃지 않게 한다.

```text
Field rules:
- Required 여부 표시
- Invalid state에서 helper text 대신 명확한 error text
- 제출 중에는 버튼 비활성화 + 진행 상태 표시
```

## Accessibility Rules

접근성은 마지막 polish가 아니라 기본 품질이다.

반드시 확인할 것:

- semantic HTML을 우선한다.
- 버튼은 버튼, 링크는 링크로 만든다.
- 모든 form control에 label이 연결되어 있다.
- 키보드만으로 주요 흐름 수행 가능
- focus order가 시각적 순서와 어긋나지 않음
- modal, menu, dialog는 focus trap과 escape close 지원
- icon-only button에는 accessible name 제공
- 색만으로 정보를 전달하지 않음

```tsx
// Good
<button type="button" aria-label="Delete task">
  <TrashIcon />
</button>
```

## Responsive Thinking

반응형은 화면이 줄어들 때 예쁘게 접는 기술이 아니다. 우선순위를 다시 배치하는 일이다.

- 작은 화면에서 가장 중요한 행동이 먼저 보이는가?
- 테이블이 모바일에서 실제로 읽히는가?
- filter, action, detail 패널이 어디로 이동하는가?
- tap target이 충분히 큰가?

레이아웃 전략:

- desktop에서 3열이면 mobile에서는 1열 재배치
- sidebar는 collapse 또는 bottom sheet 고려
- wide table은 card view 또는 중요 컬럼 우선 노출 고려

## Performance In UI

UI도 성능 설계가 필요하다.

- 한 화면에 너무 많은 stateful child를 두지 않는다.
- list rendering에는 key와 virtualization 필요 여부를 검토한다.
- 불필요한 loading spinner 대신 skeleton이나 progressive rendering을 쓴다.
- expensive derived data는 렌더마다 다시 계산하지 않게 구조를 정리한다.
- interaction latency가 큰 작업에는 pending feedback을 넣는다.

성능 최적화는 추측으로 하지 않지만, 명백한 과도한 re-render 구조는 처음부터 피한다.

## Component Boundaries

컴포넌트 분리는 줄 수가 아니라 책임 경계로 정한다.

좋은 분리:

- Page: 데이터 로딩, 라우팅, 큰 상태 orchestration
- Section: 특정 UI 블록
- Presentational component: 표시와 기본 이벤트 위임
- Hook/utility: 공용 로직

나쁜 분리:

- 한 화면을 20개의 의미 없는 wrapper로 쪼개기
- props drilling이 심한데도 구조를 고집하기
- 공용화 근거 없이 "나중에 재사용할지도 몰라서" generic component 만들기

## UI Review Checklist

구현 중간과 완료 시 아래를 본다.

- [ ] 로딩, 빈 상태, 에러 상태가 모두 존재한다.
- [ ] 주요 행동은 성공/실패 피드백이 있다.
- [ ] semantic HTML과 keyboard flow가 자연스럽다.
- [ ] mobile과 desktop에서 우선순위가 유지된다.
- [ ] 폼은 중복 제출, validation, focus 이동을 처리한다.
- [ ] 컴포넌트 경계가 책임 기준으로 나뉘어 있다.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "일단 예쁘게 만들고 상태는 나중에 붙이자" | 상태를 나중에 끼워 넣으면 구조를 다시 뜯게 된다. |
| "empty state는 데이터가 없을 때만 보니까 대충 해도 된다" | 실제 제품에서는 empty state가 첫인상인 경우가 많다. |
| "접근성은 나중에 QA에서 잡으면 된다" | 그 단계에서 고치면 구조를 다시 만들어야 하는 경우가 많다. |
| "모바일은 마지막에 보면 된다" | 데스크톱 구조가 모바일에서 바로 무너지면 나중 수정 비용이 커진다. |
| "generic component로 빼 두면 미래에 편하다" | premature abstraction은 UI를 오히려 뻣뻣하게 만든다. |

## Red Flags

- happy path만 있고 실패 상태가 없는 화면
- 클릭 후 pending feedback이 없는 action
- div로 만든 버튼과 링크
- label 없는 form control
- 모바일에서 주요 액션이 화면 아래로 밀리는 구조
- 공용화 이유가 불분명한 generic component 남발
- 구조보다 스타일을 먼저 잡는 구현 순서

## Verification

UI 구현을 마친 뒤에는 다음을 확인한다.

- [ ] 핵심 사용자 흐름이 실제로 끝까지 동작한다.
- [ ] 로딩, 빈 상태, 에러 상태가 모두 구현돼 있다.
- [ ] 키보드만으로 주요 상호작용을 수행할 수 있다.
- [ ] semantic markup과 accessible name이 적절하다.
- [ ] mobile과 desktop에서 레이아웃 우선순위가 유지된다.
- [ ] 상태 구조가 중복 source of truth 없이 정리돼 있다.
