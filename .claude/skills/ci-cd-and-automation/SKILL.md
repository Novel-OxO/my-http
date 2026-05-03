---
name: ci-cd-and-automation
description: CI/CD와 자동화 파이프라인을 설계한다. build·test·lint·deploy 게이트를 자동화하거나 수정해야 할 때, 모든 변경이 일관된 검증을 통과하게 만들어야 할 때 사용한다.
---

# CI/CD와 자동화

## Overview

품질 게이트를 자동화해서 어떤 변경도 테스트, lint, type check, build를 통과하지 않고는 운영 환경에 도달하지 못하게 만든다. CI/CD는 다른 모든 스킬의 집행 장치다. 사람과 에이전트가 놓친 것을, 모든 변경마다 일관되게 잡아낸다.

핵심 원칙:

- **Shift Left**: 문제를 가능한 앞 단계에서 잡는다.
- **Faster Is Safer**: 작은 변경을 자주 내보내는 편이 큰 변경을 드물게 내보내는 것보다 안전하다.

## When to Use

- 새 프로젝트의 CI 파이프라인을 만들 때
- 자동 검사를 추가하거나 수정할 때
- 배포 파이프라인을 구성할 때
- 특정 변경에 자동 검증이 트리거돼야 할 때
- CI 실패를 디버깅할 때

**When NOT to use:** 로컬에서만 하는 일회성 스크립트 실행이나, 팀이 공유하지 않을 임시 자동화에는 과한 절차일 수 있다. 그래도 release 경로에 닿는 자동화라면 이 기준을 따른다.

## The Quality Gate Pipeline

모든 변경은 머지 전 아래 게이트를 통과한다.

```text
Pull Request Opened
        │
        ▼
┌───────────────────────┐
│ LINT CHECK            │
│ TYPE CHECK            │
│ UNIT TESTS            │
│ BUILD                 │
│ INTEGRATION TESTS     │
│ E2E (optional)        │
│ SECURITY AUDIT        │
│ BUNDLE SIZE CHECK     │
└───────────────────────┘
        │
        ▼
Ready for Review / Merge
```

원칙:

- 게이트는 건너뛰지 않는다.
- lint가 깨지면 lint를 고친다.
- 테스트가 깨지면 코드나 테스트를 고친다.
- flaky test를 "한 번 더 돌려서 통과"로 처리하지 않는다.

## GitHub Actions Baseline

기본 파이프라인 예시:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test -- --coverage
      - run: npm run build
      - run: npm audit --audit-level=high
```

이 파이프라인이 "최종형"일 필요는 없지만, 최소한의 품질 게이트를 비워 두지 않는다.

## Database Integration Tests

DB가 필요한 테스트는 CI 안에서 repeatable한 환경을 만든다.

```yaml
integration:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_DB: testdb
        POSTGRES_USER: ci_user
        POSTGRES_PASSWORD: ${{ secrets.CI_DB_PASSWORD }}
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5

  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'
    - run: npm ci
    - run: npx prisma migrate deploy
      env:
        DATABASE_URL: postgresql://ci_user:${{ secrets.CI_DB_PASSWORD }}@localhost:5432/testdb
    - run: npm run test:integration
      env:
        DATABASE_URL: postgresql://ci_user:${{ secrets.CI_DB_PASSWORD }}@localhost:5432/testdb
```

CI 전용 테스트 DB라도 자격 증명은 secret manager에 둔다. "테스트용이라서 하드코딩해도 된다"는 습관을 만들지 않는다.

## E2E Tests

브라우저 자동화는 별도 job으로 분리하는 편이 관리하기 쉽다.

```yaml
e2e:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    - run: npm run build
    - run: npx playwright test
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

실패 시 artifact를 남겨서 사람이 바로 triage할 수 있게 한다.

## Feeding CI Failures Back To Agents

CI와 에이전트를 함께 쓸 때 핵심은 feedback loop다.

```text
CI fails
  ↓
구체적인 실패 출력 복사
  ↓
에이전트에 전달
  ↓
에이전트가 로컬에서 재현·수정·검증
  ↓
다시 push → CI 재실행
```

패턴:

- lint failure → `npm run lint --fix` 또는 원인 수정
- type error → 지정된 위치 타입 수정
- test failure → `debugging-and-error-recovery` 흐름
- build failure → config/dependency/environment 확인

핵심은 **실패 로그 전체를 던지는 것보다, 실제 실패한 부분을 정확히 잘라서 되먹이는 것**이다.

## Deployment Strategies

### Preview Deployments

PR마다 preview 환경을 만든다.

이점:

- 수동 QA가 쉬워진다.
- 디자인/제품 리뷰가 빨라진다.
- production 전 실제 환경과 유사한 상태를 볼 수 있다.

### Feature Flags

배포와 릴리스를 분리한다.

```typescript
if (featureFlags.isEnabled('new-checkout-flow', { userId })) {
  return renderNewCheckout();
}

return renderLegacyCheckout();
```

feature flag로 가능한 것:

- 미완성 기능도 main에 머지
- 재배포 없이 끄기
- canary rollout
- A/B test

flag lifecycle:

```text
Create → Internal test → Canary → Full rollout → Remove flag + dead code
```

끝나지 않는 flag는 기술 부채다. 생성 시 cleanup 시점도 정한다.

### Staged Rollouts

```text
PR merged
  ↓
Staging deploy
  ↓
Manual verification
  ↓
Production deploy
  ↓
15-minute monitoring window
  ├── Error detected → rollback
  └── Clean → done
```

배포는 "나갔다"가 끝이 아니라, 짧은 관찰 구간까지 포함해야 한다.

### Rollback Plan

모든 배포에는 되돌리는 절차가 있어야 한다.

```yaml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to rollback to'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - run: npx vercel rollback ${{ inputs.version }}
```

"필요하면 그때 생각하자"는 rollback 계획이 아니다.

## Environment Management

```text
.env.example   → 커밋 가능, template
.env           → 커밋 금지, local dev
.env.test      → 커밋 가능, real secret 없음
CI secrets     → GitHub Secrets / vault
Prod secrets   → deploy platform / vault
```

CI에는 production secret을 넣지 않는다. 테스트용 secret을 따로 만든다.

## Automation Beyond CI

### Dependabot / Renovate

dependency update도 자동화한다.

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
```

### Build Cop

빌드가 깨졌을 때 책임지고 녹색 상태를 복구하는 역할을 둔다. 누가 깨뜨렸느냐보다 **누가 빨리 고치거나 revert하느냐**가 더 중요하다.

### PR Checks

- 최소 1명 이상 review approval
- CI required status check
- main branch protection
- 조건 충족 시 auto-merge 가능

## CI Optimization

파이프라인이 10분을 넘기면 아래 순서대로 최적화한다.

```text
1. dependency cache
2. job parallelization
3. path filter로 관련 없는 작업 skip
4. matrix / test sharding
5. 느린 테스트를 critical path 밖으로 이동
6. larger runner 검토
```

예시:

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
```

최적화는 게이트를 빼는 것이 아니라, **같은 게이트를 더 빨리 돌리는 것**이다.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "CI가 너무 느리다" | 느리면 최적화해야지, 빼면 안 된다. 몇 분의 CI가 몇 시간의 디버깅을 막는다. |
| "이건 사소한 변경이니 CI를 건너뛰자" | 사소한 변경도 빌드를 깨뜨린다. |
| "flaky test면 그냥 다시 돌리면 된다" | flaky test는 실제 버그를 숨기고 팀 시간을 갉아먹는다. |
| "CI는 나중에 붙이면 된다" | CI 없는 프로젝트는 깨진 상태를 누적시킨다. |
| "수동 테스트면 충분하다" | 수동 테스트는 반복성과 커버리지가 부족하다. 자동화 가능한 것은 자동화한다. |

## Red Flags

- CI 파이프라인이 아예 없는 프로젝트
- 실패한 CI를 무시하거나 소거하는 문화
- 파이프라인을 통과시키려고 테스트를 끄는 행동
- staging 검증 없는 production deploy
- rollback 메커니즘 부재
- secret이 코드나 CI 설정 파일에 박혀 있는 상태
- 10분 넘는 CI인데 최적화 시도가 없는 상태

## Verification

CI/CD를 만들거나 수정한 뒤에는 다음을 확인한다.

- [ ] lint, types, tests, build, audit 같은 품질 게이트가 존재한다.
- [ ] 모든 PR과 main push에서 파이프라인이 실행된다.
- [ ] 실패 시 merge가 막힌다. branch protection이 있다.
- [ ] CI 결과가 실제 개발 루프에 되먹여진다.
- [ ] secret은 코드가 아니라 secret manager에 저장된다.
- [ ] deploy에는 rollback 메커니즘이 있다.
- [ ] 테스트 기준 파이프라인이 10분 이내로 유지되거나 최적화 계획이 있다.
