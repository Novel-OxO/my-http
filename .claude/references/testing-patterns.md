# 테스트 패턴 참조

스택 전반의 일반적인 테스트 패턴 빠른 참조. `test-principal` 스킬과 함께 사용합니다.

## 목차

- [테스트 구조 (Arrange-Act-Assert)](#테스트-구조-arrange-act-assert)
- [테스트 네이밍 컨벤션](#테스트-네이밍-컨벤션)
- [일반적인 어서션](#일반적인-어서션)
- [Mocking 패턴](#mocking-패턴)
- [React/컴포넌트 테스트](#react컴포넌트-테스트)
- [API / 통합 테스트](#api--통합-테스트)
- [E2E 테스트 (Playwright)](#e2e-테스트-playwright)
- [테스트 안티 패턴](#테스트-안티-패턴)

## 테스트 구조 (Arrange-Act-Assert)

```typescript
it('기대 동작을 설명', () => {
  // Arrange: 테스트 데이터와 사전 조건 설정
  const input = { title: 'Test Task', priority: 'high' };

  // Act: 테스트 대상 동작 수행
  const result = createTask(input);

  // Assert: 결과 검증
  expect(result.title).toBe('Test Task');
  expect(result.priority).toBe('high');
  expect(result.status).toBe('pending');
});
```

## 테스트 네이밍 컨벤션

```typescript
// 패턴: [단위] [기대 동작] [조건]
describe('TaskService.createTask', () => {
  it('기본 pending 상태로 태스크 생성', () => {});
  it('제목이 비어있으면 ValidationError 발생', () => {});
  it('제목의 공백을 트림', () => {});
  it('각 태스크에 고유 ID 생성', () => {});
});
```

## 일반적인 어서션

```typescript
// 동등성
expect(result).toBe(expected);           // 엄격 동등 (===)
expect(result).toEqual(expected);        // 깊은 동등 (객체/배열)
expect(result).toStrictEqual(expected);  // 깊은 동등 + 타입 매칭

// 진위
expect(result).toBeTruthy();
expect(result).toBeFalsy();
expect(result).toBeNull();
expect(result).toBeDefined();
expect(result).toBeUndefined();

// 숫자
expect(result).toBeGreaterThan(5);
expect(result).toBeLessThanOrEqual(10);
expect(result).toBeCloseTo(0.3, 5);      // 부동소수점

// 문자열
expect(result).toMatch(/pattern/);
expect(result).toContain('substring');

// 배열 / 객체
expect(array).toContain(item);
expect(array).toHaveLength(3);
expect(object).toHaveProperty('key', 'value');

// 에러
expect(() => fn()).toThrow();
expect(() => fn()).toThrow(ValidationError);
expect(() => fn()).toThrow('specific message');

// 비동기
await expect(asyncFn()).resolves.toBe(value);
await expect(asyncFn()).rejects.toThrow(Error);
```

## Mocking 패턴

### Mock 함수

```typescript
const mockFn = jest.fn();
mockFn.mockReturnValue(42);
mockFn.mockResolvedValue({ data: 'test' });
mockFn.mockImplementation((x) => x * 2);

expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenCalledTimes(3);
```

### Mock 모듈

```typescript
// 전체 모듈 mock
jest.mock('./database', () => ({
  query: jest.fn().mockResolvedValue([{ id: 1, title: 'Test' }]),
}));

// 특정 export만 mock
jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  generateId: jest.fn().mockReturnValue('test-id'),
}));
```

### 경계에서만 Mock

```
Mock할 것:                     Mock하지 말 것:
├── 데이터베이스 호출          ├── 내부 유틸리티 함수
├── HTTP 요청                  ├── 비즈니스 로직
├── 파일 시스템 연산           ├── 데이터 변환
├── 외부 API 호출              ├── 검증 함수
└── 시간/날짜 (필요 시)        └── 순수 함수
```

## React/컴포넌트 테스트

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('TaskForm', () => {
  it('입력된 데이터로 폼 제출', async () => {
    const onSubmit = jest.fn();
    render(<TaskForm onSubmit={onSubmit} />);

    // 접근 가능한 role/label로 요소 찾기 (test ID 아님)
    await screen.findByRole('textbox', { name: /title/i });
    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), {
      target: { value: 'New Task' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ title: 'New Task' });
    });
  });

  it('빈 제목에 대해 검증 에러 표시', async () => {
    render(<TaskForm onSubmit={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
  });
});
```

## API / 통합 테스트

```typescript
import request from 'supertest';
import { app } from '../src/app';

describe('POST /api/tasks', () => {
  it('태스크를 생성하고 201 반환', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Test Task' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      title: 'Test Task',
      status: 'pending',
    });
  });

  it('유효하지 않은 입력에 대해 422 반환', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: '' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('인증 없이 401 반환', async () => {
    await request(app)
      .post('/api/tasks')
      .send({ title: 'Test' })
      .expect(401);
  });
});
```

## E2E 테스트 (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('사용자가 태스크를 생성하고 완료할 수 있다', async ({ page }) => {
  // 이동 및 인증
  await page.goto('/');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'testpass123');
  await page.click('button:has-text("Log in")');

  // 태스크 생성
  await page.click('button:has-text("New Task")');
  await page.fill('[name="title"]', 'Buy groceries');
  await page.click('button:has-text("Create")');

  // 태스크 표시 확인
  await expect(page.locator('text=Buy groceries')).toBeVisible();

  // 태스크 완료
  await page.click('[aria-label="Complete Buy groceries"]');
  await expect(page.locator('text=Buy groceries')).toHaveCSS(
    'text-decoration-line', 'line-through'
  );
});
```

## 테스트 안티 패턴

| 안티 패턴 | 문제점 | 더 나은 접근 |
|---|---|---|
| 구현 세부 테스트 | 리팩터링에서 깨짐 | 입력/출력 테스트 |
| 모든 것 스냅샷 | 스냅샷 diff를 아무도 안 봄 | 구체 값 어서션 |
| 공유 가변 상태 | 테스트 간 오염 | 테스트마다 setup/teardown |
| 서드파티 코드 테스트 | 시간 낭비, 우리 버그 아님 | 경계에서 mock |
| CI 통과용 테스트 스킵 | 실제 버그 숨김 | 수정하거나 삭제 |
| `test.skip` 영구 사용 | 죽은 코드 | 제거 또는 수정 |
| 지나치게 넓은 어서션 | 회귀를 못 잡음 | 구체적으로 |
| 비동기 에러 미처리 | 삼켜진 에러, 거짓 통과 | 비동기 테스트 항상 `await` |
