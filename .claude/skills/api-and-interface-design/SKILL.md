---
name: api-and-interface-design
description: 안정적인 API와 인터페이스를 설계한다. 엔드포인트, 모듈 경계, 타입 계약, 프런트엔드와 백엔드 사이 인터페이스를 새로 정의하거나 바꿀 때 사용한다.
---

# API와 인터페이스 설계

## Overview

오용하기 어렵고, 확장하기 쉬우며, 문서화 가능한 인터페이스를 설계한다. 좋은 인터페이스는 올바른 사용을 쉽게 만들고, 잘못된 사용을 어렵게 만든다.

이 스킬은 REST API, GraphQL schema, 모듈 경계, component props, 타입 계약처럼 "코드 한 부분이 다른 부분과 대화하는 모든 표면"에 적용된다.

## When to Use

- 새 API endpoint를 설계할 때
- 팀 간 모듈 경계나 계약을 정의할 때
- component props interface를 정할 때
- 데이터베이스 스키마가 API 형태에 직접 영향을 줄 때
- 기존 public interface를 바꿔야 할 때

**When NOT to use:** 순수 내부 구현 변경으로 외부 계약이 달라지지 않는 작업에는 과한 절차일 수 있다. 이미 명확한 contract가 있고 구현만 남은 경우에는 `incremental-implementation`으로 진행한다.

## Core Principles

### Hyrum's Law

> 충분히 많은 사용자가 있는 API에서는, 계약에 약속하지 않은 모든 관찰 가능한 동작도 누군가에게는 의존 대상이 된다.

의미:

- 문서화하지 않은 quirks도 사실상 계약이 될 수 있다.
- 에러 문구, ordering, timing, null 처리도 누군가는 기대한다.
- "테스트는 다 통과한다"가 안전한 변경을 보장하지는 않는다.

설계 함의:

- 드러나는 동작을 의도적으로 선택한다.
- 구현 세부사항을 밖으로 새지 않게 한다.
- 제거보다 추가를 선호한다.
- 폐기 전략을 설계 시점부터 생각한다. 관련 절차는 `deprecation-and-migration`을 따른다.

### The One-Version Rule

같은 의존성이나 계약의 여러 버전을 동시에 떠안게 만들지 않는다. 가능한 한 **한 시점에 한 버전**만 존재한다고 가정하고, fork보다 extension을 택한다.

다중 버전은 다음 비용을 만든다.

- diamond dependency 문제
- 소비자별 conditional logic 증가
- 문서와 테스트 이중화
- 폐기 비용 증가

## 1. Contract First

구현 전에 계약을 먼저 정의한다. contract가 spec이고, 구현은 그 뒤를 따른다.

```typescript
interface TaskAPI {
  createTask(input: CreateTaskInput): Promise<Task>;
  listTasks(params: ListTasksParams): Promise<Paginated<Task>>;
  getTask(id: TaskId): Promise<Task>;
  updateTask(id: TaskId, input: UpdateTaskInput): Promise<Task>;
  deleteTask(id: TaskId): Promise<void>;
}
```

이렇게 하면 구현 전에 아래를 검토할 수 있다.

- 입력과 출력이 명확한가?
- pagination, filtering, partial update가 필요한가?
- 에러 semantics가 일관적인가?
- 타입 이름이 역할을 설명하는가?

## 2. Consistent Error Semantics

에러 전략은 하나로 고정하고 전체 표면에서 일관되게 쓴다.

```typescript
interface APIError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

예시 매핑:

- `400`: 형식이 잘못된 요청
- `401`: 인증 안 됨
- `403`: 인증은 됐지만 권한 없음
- `404`: 리소스 없음
- `409`: 충돌
- `422`: 의미상 validation 실패
- `500`: 서버 오류, 내부 정보 노출 금지

하지 말아야 할 것:

- 어떤 endpoint는 throw
- 어떤 endpoint는 `null`
- 어떤 endpoint는 `{ error }`

소비자가 예측할 수 없는 인터페이스는 좋은 인터페이스가 아니다.

## 3. Validate At Boundaries

검증은 시스템 경계에서 한다. 내부 코드는 이미 검증된 계약을 신뢰한다.

```typescript
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid task data',
        details: result.error.flatten(),
      },
    });
  }

  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

검증이 필요한 위치:

- API route handler
- form submit handler
- 외부 서비스 응답 파싱
- 환경 변수 로딩

검증이 필요 없는 위치:

- 이미 typed contract를 공유하는 내부 함수 사이
- 이미 검증된 데이터를 사용하는 내부 유틸리티
- 방금 우리 DB에서 읽어온 데이터

**Third-party API 응답은 항상 불신한다.** 타입과 내용 모두 검증한 뒤 로직이나 렌더링에 사용한다.

## 4. Prefer Addition Over Modification

기존 소비자를 깨지 않도록, 수정보다 추가를 선호한다.

```typescript
// Good
interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  labels?: string[];
}

// Bad
interface CreateTaskInput {
  title: string;
  priority: number;
}
```

좋은 기본값:

- 새 필드는 optional
- 기존 필드 타입은 유지
- 제거는 deprecation 경로 후에만

## 5. Predictable Naming

네이밍은 스타일 문제가 아니라 소비자 예측 가능성 문제다.

| Pattern | Convention | Example |
|---|---|---|
| REST endpoint | plural noun, no verb | `GET /api/tasks` |
| Query param | camelCase | `?sortBy=createdAt&pageSize=20` |
| Response field | camelCase | `{ createdAt, updatedAt, taskId }` |
| Boolean field | `is/has/can` prefix | `isComplete`, `hasAttachments` |
| Enum value | `UPPER_SNAKE` | `"IN_PROGRESS"` |

`/api/createTask`, `/api/getUsers`처럼 동사를 URL에 넣는 패턴은 피한다.

## REST API Patterns

### Resource Design

```text
GET    /api/tasks              → 목록 조회
POST   /api/tasks              → 생성
GET    /api/tasks/:id          → 단건 조회
PATCH  /api/tasks/:id          → 부분 수정
DELETE /api/tasks/:id          → 삭제
GET    /api/tasks/:id/comments → 하위 리소스 목록
POST   /api/tasks/:id/comments → 하위 리소스 생성
```

### Pagination

list endpoint는 처음부터 pagination을 넣는다.

```typescript
// Request
GET /api/tasks?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc

// Response
{
  data: [...],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 142,
    totalPages: 8
  }
}
```

### Filtering

filter는 query parameter로 표현한다.

```text
GET /api/tasks?status=in_progress&assignee=user123&createdAfter=2025-01-01
```

### Partial Updates

부분 수정은 `PATCH`로 받고, 전달된 필드만 바꾼다.

```json
PATCH /api/tasks/123
{
  "title": "Updated title"
}
```

## TypeScript Interface Patterns

### Discriminated Unions

variant가 있는 상태는 명시적으로 모델링한다.

```typescript
type TaskStatus =
  | { type: 'pending' }
  | { type: 'in_progress'; assignee: string; startedAt: Date }
  | { type: 'completed'; completedAt: Date; completedBy: string }
  | { type: 'cancelled'; reason: string; cancelledAt: Date };
```

이렇게 해야 consumer가 안전하게 narrowing할 수 있다.

### Input / Output Separation

입력 타입과 출력 타입을 섞지 않는다.

```typescript
interface CreateTaskInput {
  title: string;
  description?: string;
}

interface Task {
  id: TaskId;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: UserId;
}
```

시스템이 생성하는 필드와 caller가 넣는 필드를 분리하면 계약이 더 선명해진다.

### Branded IDs

ID 혼동 위험이 큰 코드베이스라면 branded type을 고려한다.

```typescript
type TaskId = string & { readonly __brand: 'TaskId' };
type UserId = string & { readonly __brand: 'UserId' };
```

이 방식은 `UserId`를 `TaskId` 자리에 잘못 넣는 실수를 줄인다.

## Interface Review Questions

설계 검토 시 다음을 묻는다.

- 이 계약은 오용하기 쉬운가, 어려운가?
- 입력/출력이 타입으로 충분히 설명되는가?
- 에러 semantics가 일관적인가?
- 현재 소비자를 깨지 않고 확장할 수 있는가?
- 경계 검증 위치가 명확한가?
- 관찰 가능한 동작 중 불필요하게 노출된 것이 있는가?

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "API는 나중에 문서화하면 된다" | 타입과 계약이 문서다. 먼저 정의해야 한다. |
| "pagination은 나중에 넣자" | 100개를 넘는 순간 소비자를 깨뜨리지 않고 넣기가 더 어려워진다. |
| "PATCH는 복잡하니 PUT으로 통일하자" | 소비자는 대개 전체 객체를 매번 보내고 싶어 하지 않는다. |
| "버전은 필요할 때 나누면 된다" | 준비 없는 breaking change는 즉시 소비자를 깬다. |
| "문서화되지 않은 동작은 아무도 안 쓸 거다" | Hyrum's Law상 보이는 순간 누군가는 의존한다. |
| "내부 API는 계약이 없어도 된다" | 내부 소비자도 소비자다. 계약이 있어야 병렬 작업과 변경이 가능하다. |

## Red Flags

- 조건에 따라 응답 shape가 달라지는 endpoint
- endpoint마다 다른 error format
- 경계가 아니라 내부 전역에 흩어진 validation
- 기존 필드의 타입 변경이나 제거 같은 breaking change
- pagination 없는 list endpoint
- 동사가 들어간 REST URL
- 검증 없이 바로 쓰는 third-party API 응답

## Verification

API나 인터페이스를 설계한 뒤에는 다음을 확인한다.

- [ ] 모든 endpoint 또는 public interface에 typed input/output schema가 있다.
- [ ] 에러 응답은 하나의 일관된 형식을 따른다.
- [ ] validation은 시스템 경계에서만 수행된다.
- [ ] list endpoint는 pagination을 지원한다.
- [ ] 새 필드는 additive하고 backward compatible하다.
- [ ] 네이밍 규칙이 전체 인터페이스에서 일관된다.
- [ ] 계약 문서나 타입 정의가 구현과 함께 저장된다.
