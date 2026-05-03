---
name: performance-optimization
description: 성능을 측정 기반으로 최적화한다. 성능 요구사항이 있거나, 회귀가 의심되거나, Core Web Vitals·응답 시간·대용량 처리 성능을 개선해야 할 때 사용한다.
---

# 성능 최적화

## Overview

측정 없이 하는 성능 작업은 추측이다. 성능 최적화는 "뭔가 느릴 것 같은 부분"을 손대는 일이 아니라, 실제 병목을 측정하고, 그 병목만 고치고, 다시 측정해 개선을 증명하는 일이다.

핵심 흐름:

```text
Measure → Identify → Fix → Verify → Guard
```

## When to Use

- spec에 성능 요구사항이 있을 때
- 사용자나 모니터링이 느린 동작을 보고할 때
- Core Web Vitals 점수가 기준 미만일 때
- 특정 변경이 성능 회귀를 만들었을 가능성이 있을 때
- 큰 데이터셋, 고트래픽, 무거운 상호작용을 다루는 기능을 만들 때

**When NOT to use:** 문제 증거가 없는데 미리 최적화하는 경우. premature optimization은 복잡도만 키우고 실제 개선은 없을 수 있다.

## Core Web Vitals Targets

| Metric | Good | Needs Improvement | Poor |
|---|---|---|---|
| `LCP` | `<= 2.5s` | `<= 4.0s` | `> 4.0s` |
| `INP` | `<= 200ms` | `<= 500ms` | `> 500ms` |
| `CLS` | `<= 0.1` | `<= 0.25` | `> 0.25` |

이 수치는 출발 기준이다. 실제 프로젝트는 spec이나 제품 목표에 더 엄격한 budget을 둘 수 있다.

## The Optimization Workflow

```text
1. MEASURE  → baseline 확보
2. IDENTIFY → 실제 병목 찾기
3. FIX      → 그 병목만 해결
4. VERIFY   → 다시 측정해 개선 확인
5. GUARD    → 회귀 방지 장치 추가
```

## Step 1: Measure

### Frontend

- Lighthouse
- Chrome DevTools Performance trace
- Web Vitals instrumentation
- bundle analyzer
- network waterfall

예:

```typescript
import { onLCP, onINP, onCLS } from 'web-vitals';

onLCP(console.log);
onINP(console.log);
onCLS(console.log);
```

### Backend

- endpoint 응답 시간 로깅
- APM
- database query timing
- CPU / memory profile

예:

```typescript
console.time('db-query');
const result = await db.query(...);
console.timeEnd('db-query');
```

## Where To Start Measuring

증상에 따라 첫 측정 지점을 고른다.

```text
What is slow?
├── First page load
│   ├── bundle too large?
│   ├── server response slow?
│   └── render-blocking CSS/JS?
├── Interaction feels sluggish
│   ├── main thread long task?
│   ├── input lag from re-renders?
│   └── animation jank from layout thrashing?
├── Navigation to next page
│   ├── data waterfall?
│   └── client render bottleneck?
└── Backend / API
    ├── specific endpoint slow?
    ├── all endpoints slow?
    └── intermittent latency?
```

측정 대상을 잘못 잡으면, optimization도 엉뚱한 곳으로 간다.

## Step 2: Identify The Bottleneck

### Frontend Bottlenecks

| Symptom | Likely Cause | Investigation |
|---|---|---|
| Slow `LCP` | 큰 이미지, render-blocking resource, 느린 서버 | waterfall, image size |
| High `CLS` | dimension 없는 이미지, late-loading content, font shift | layout shift attribution |
| Poor `INP` | 무거운 JS, 큰 DOM update | long task trace |
| Slow initial load | 큰 bundle, 많은 network request | bundle size, code splitting |

### Backend Bottlenecks

| Symptom | Likely Cause | Investigation |
|---|---|---|
| Slow API response | N+1 query, missing index | DB query log |
| Memory growth | leaked reference, unbounded cache | heap snapshot |
| CPU spike | sync heavy computation, regex backtracking | CPU profile |
| High latency | missing cache, redundant work, network hop | request trace |

## Step 3: Fix Common Anti-Patterns

### N+1 Queries

```typescript
// BAD
const tasks = await db.tasks.findMany();
for (const task of tasks) {
  task.owner = await db.users.findUnique({ where: { id: task.ownerId } });
}

// GOOD
const tasks = await db.tasks.findMany({
  include: { owner: true },
});
```

### Unbounded Data Fetching

```typescript
// BAD
const allTasks = await db.tasks.findMany();

// GOOD
const tasks = await db.tasks.findMany({
  take: 20,
  skip: (page - 1) * 20,
  orderBy: { createdAt: 'desc' },
});
```

### Missing Image Optimization

- width/height 명시
- responsive size 사용
- above-the-fold 이미지는 더 엄격하게 관리
- lazy loading 적용 가능 여부 확인

### Unnecessary Re-renders

```tsx
// BAD
function TaskList() {
  return <TaskFilters options={{ sortBy: 'date', order: 'desc' }} />;
}

// GOOD
const DEFAULT_OPTIONS = { sortBy: 'date', order: 'desc' } as const;

function TaskList() {
  return <TaskFilters options={DEFAULT_OPTIONS} />;
}
```

주의:

- `React.memo`, `useMemo`는 증거 없이 남발하지 않는다.
- 하지만 expensive computation이나 unstable reference가 실제 병목이면 선택적으로 쓴다.

### Large Bundle Size

```typescript
// Prefer tree-shakable import when supported
import format from 'date-fns/format';

// Rare heavy feature
const ChartLibrary = lazy(() => import('./ChartLibrary'));
```

### Missing Caching

```typescript
const CACHE_TTL = 5 * 60 * 1000;
let cachedConfig: AppConfig | null = null;
let cacheExpiry = 0;

async function getAppConfig(): Promise<AppConfig> {
  if (cachedConfig && Date.now() < cacheExpiry) {
    return cachedConfig;
  }

  cachedConfig = await db.config.findFirst();
  cacheExpiry = Date.now() + CACHE_TTL;
  return cachedConfig;
}
```

static asset과 API response도 적절한 cache policy를 가진다.

## Performance Budget

budget을 숫자로 정하고 가능하면 CI에서 강제한다.

예시:

```text
Initial JS bundle: < 200KB gzipped
CSS: < 50KB gzipped
Above-the-fold image: < 200KB
Fonts total: < 100KB
API response time: < 200ms p95
TTI on 4G: < 3.5s
Lighthouse performance: >= 90
```

CI 예시:

```bash
npx bundlesize --config bundlesize.config.json
npx lhci autorun
```

## Guard Against Regression

성능 최적화가 끝나면 회귀 방지 장치를 남긴다.

- Web Vitals metric 수집
- bundle size check
- slow query logging
- endpoint latency alert
- performance regression review in CI

측정 없는 최적화만큼, guard 없는 최적화도 오래 가지 못한다.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "나중에 최적화하면 된다" | 명백한 anti-pattern은 지금 고치는 편이 싸다. |
| "내 머신에서 빠르다" | 사용자의 기기와 네트워크는 다르다. representative 환경에서 봐야 한다. |
| "이 최적화는 당연히 효과가 있다" | 측정하지 않았다면 모르는 것이다. |
| "사용자는 100ms쯤은 못 느낀다" | 작은 지연도 누적되면 체감과 전환율에 영향을 준다. |
| "프레임워크가 성능은 알아서 해 준다" | 프레임워크는 일부 문제만 막는다. N+1, oversized bundle, slow query는 직접 봐야 한다. |

## Red Flags

- profiling 데이터 없이 최적화를 시작하는 경우
- data fetching에 N+1 패턴이 있는 경우
- pagination 없는 list endpoint
- dimension/lazy loading/responsive size 없는 이미지
- review 없이 bundle size가 계속 커지는 경우
- production monitoring 없는 상태
- `React.memo`와 `useMemo`를 증거 없이 남발하는 경우

## Verification

성능 관련 변경 뒤에는 다음을 확인한다.

- [ ] before / after 측정값이 있다.
- [ ] 실제 병목이 식별되고 해결됐다.
- [ ] Core Web Vitals가 목표 범위 안에 있다.
- [ ] bundle size가 의미 있게 악화되지 않았다.
- [ ] 새 data fetching 코드에 N+1이 없다.
- [ ] CI performance budget이 있다면 통과한다.
- [ ] 기존 테스트가 통과한다.
