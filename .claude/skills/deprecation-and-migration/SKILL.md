---
name: deprecation-and-migration
description: 폐기와 마이그레이션을 관리한다. 오래된 시스템·API·기능을 제거하거나, 사용자를 새 구현으로 안전하게 옮겨야 할 때, 유지할지 종료할지 판단해야 할 때 사용한다.
---

# 폐기와 마이그레이션

## Overview

코드는 자산이 아니라 부채에 가깝다. 모든 코드 줄은 테스트, 문서, 보안 패치, dependency update, 온보딩 비용을 계속 만든다. 폐기는 더 이상 유지비를 정당화하지 못하는 코드를 제거하는 규율이고, 마이그레이션은 사용자를 기존 것에서 새 것으로 안전하게 옮기는 과정이다.

대부분의 팀은 만드는 데는 익숙하지만, 제거하는 데는 약하다. 이 스킬은 그 빈틈을 다룬다.

## When to Use

- 오래된 시스템, API, 라이브러리를 새 것으로 교체할 때
- 더 이상 필요 없는 기능을 sunset할 때
- 중복 구현을 하나로 합칠 때
- 아무도 소유하지 않지만 모두가 의존하는 dead/zombie code를 정리할 때
- 새 시스템의 lifecycle을 설계할 때
- legacy system을 유지할지 migration에 투자할지 결정할 때

**When NOT to use:** 대체재도 없고, 실제 사용량과 가치도 파악하지 않은 상태에서 "낡아 보여서" 없애는 일에는 쓰지 않는다.

## Core Principles

### Code Is A Liability

코드의 가치는 코드 자체가 아니라 제공하는 기능에 있다. 같은 기능을 더 적은 코드, 더 낮은 복잡도, 더 좋은 추상화로 제공할 수 있다면, 기존 코드는 언젠가 제거돼야 한다.

### Hyrum's Law Makes Removal Hard

사용자가 충분히 많으면, 문서화되지 않은 quirks와 timing과 side effect까지 누군가는 의존한다. 그래서 폐기는 공지 한 줄로 끝나지 않는다. **능동적 마이그레이션**이 필요하다.

### Deprecation Planning Starts At Design Time

새것을 만들 때부터 "3년 뒤 이걸 어떻게 없앨 것인가?"를 묻는다.

다음 특성을 가진 시스템이 제거하기 쉽다.

- clean interface
- 좁은 public surface
- feature flag
- implementation detail leak 최소화

## The Deprecation Decision

무엇을 폐기할지 결정하기 전에 아래 질문에 답한다.

```text
1. 아직도 고유한 가치를 제공하는가?
   → YES면 유지, NO면 폐기 검토

2. 얼마나 많은 사용자/소비자가 의존하는가?
   → migration 범위를 수량화

3. 대체재가 존재하는가?
   → 없으면 먼저 대체재를 만든다

4. 각 소비자의 migration 비용은 얼마인가?
   → 자동화 가능한가, 수동으로 얼마나 무거운가

5. 지금 폐기하지 않을 때의 유지 비용은 얼마인가?
   → 보안 리스크, 엔지니어 시간, 복잡도 기회비용
```

## Advisory vs Compulsory

| Type | When To Use | Mechanism |
|---|---|---|
| Advisory | 구 시스템이 아직 안정적이고 migration이 선택 사항일 때 | warning, 문서, nudges |
| Compulsory | 보안 리스크가 크거나 유지 비용이 감당 불가일 때 | hard deadline + migration tooling |

기본값은 **Advisory**다. Compulsory는 진짜로 강제해야 할 비용이나 위험이 있을 때만 쓴다.

Compulsory 폐기에는 최소한 아래가 필요하다.

- migration tooling
- migration guide
- support channel
- 명확한 종료 시점

## The Migration Process

### Step 1: Build The Replacement

대체재 없이 폐기부터 하지 않는다.

대체재 조건:

- 기존 시스템의 critical use case를 모두 커버
- 문서와 migration guide 존재
- 이론상 더 낫다가 아니라 production에서 증명됨

### Step 2: Announce And Document

```markdown
## Deprecation Notice: OldService

**Status:** Deprecated as of 2025-03-01
**Replacement:** NewService
**Removal date:** Advisory — no hard deadline yet
**Reason:** OldService는 수동 확장이 필요하고 observability가 약함

### Migration Guide
1. `import { client } from 'old-service'` → `import { client } from 'new-service'`
2. 설정 값 업데이트
3. `npx migrate-check` 실행
```

공지에는 다음이 빠지면 안 된다.

- 무엇이 대체재인지
- 왜 바꾸는지
- 언제 없어질지
- 어떻게 옮기는지

### Step 3: Migrate Incrementally

소비자를 한 번에 다 옮기지 않는다. 하나씩 이동한다.

각 소비자마다:

1. deprecated 시스템과의 모든 접점을 찾는다.
2. 대체재로 바꾼다.
3. 동작이 같은지 검증한다.
4. 기존 시스템 참조를 제거한다.
5. 회귀가 없는지 확인한다.

### The Churn Rule

네가 폐기하는 인프라를 소유하고 있다면, 사용자 migration도 네 책임이다. 아니면 backward-compatible adapter나 no-migration upgrade path를 제공한다.

"이제 deprecated니까 알아서 옮기세요"는 책임 회피다.

### Step 4: Remove The Old System

모든 소비자 이동 후에만 제거한다.

```text
1. active usage가 0인지 확인
2. old code 제거
3. 관련 테스트, 문서, 설정 제거
4. deprecation notice 제거
5. 종료 확인
```

코드를 지우는 것은 성취다. 축하할 일이다.

## Migration Patterns

### Strangler Pattern

구 시스템과 새 시스템을 병렬로 두고, 트래픽을 점진적으로 새쪽으로 옮긴다.

```text
Phase 1: New 0% / Old 100%
Phase 2: New 10% / Old 90%
Phase 3: New 50% / Old 50%
Phase 4: New 100% / Old idle
Phase 5: Old 제거
```

### Adapter Pattern

기존 인터페이스를 유지한 채 내부 구현만 새 시스템으로 위임한다.

```typescript
class LegacyTaskService implements OldTaskAPI {
  constructor(private newService: NewTaskService) {}

  getTask(id: number): OldTask {
    const task = this.newService.findById(String(id));
    return this.toOldFormat(task);
  }
}
```

이 방식은 소비자 migration 속도를 늦춰도 backend migration을 먼저 진행할 수 있게 한다.

### Feature Flag Migration

feature flag로 소비자를 하나씩 전환한다.

```typescript
function getTaskService(userId: string): TaskService {
  if (featureFlags.isEnabled('new-task-service', { userId })) {
    return new NewTaskService();
  }

  return new LegacyTaskService();
}
```

## Zombie Code

zombie code는 아무도 소유하지 않지만 모두가 의존하는 코드다.

신호:

- 6개월 이상 커밋 없음
- owner/team이 불명확
- failing test를 아무도 고치지 않음
- 알려진 취약 dependency가 방치됨
- 이미 사라진 시스템을 문서가 계속 참조함

대응:

- owner를 지정하고 유지 책임 부여
- 아니면 concrete migration plan을 가진 폐기로 전환

limbo 상태는 허용하지 않는다.

## Measuring Readiness For Removal

제거 직전 확인할 것:

- active traffic / call volume
- import/reference count
- log 기반 usage
- dependent team / consumer inventory
- support ticket 영향

측정 없이 없애는 것은 migration이 아니라 도박이다.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "아직 동작하니까 굳이 없앨 필요 없다" | 유지되지 않는 동작하는 코드는 보안 부채와 복잡도를 축적한다. |
| "나중에 누가 필요할지도 모른다" | 필요하면 다시 만들 수 있다. just-in-case 보존 비용이 더 비싸다. |
| "migration 비용이 너무 크다" | 2~3년 유지 비용과 비교하면 보통 migration이 더 싸다. |
| "새 시스템 만들고 나서 폐기는 나중에 하자" | 그때쯤이면 다른 우선순위가 끼어든다. 계획은 설계 시점부터 필요하다. |
| "사용자가 알아서 옮길 것이다" | 대부분 그렇지 않다. tooling, docs, incentive가 필요하다. |
| "둘 다 영구히 유지하면 되지" | 같은 기능 두 벌은 테스트, 문서, 운영, 온보딩 비용을 두 배로 만든다. |

## Red Flags

- replacement 없이 deprecated로 표시된 시스템
- migration tooling이나 문서 없는 deprecation notice
- 몇 년째 advisory로만 남아 있는 soft deprecation
- owner 없는 zombie code와 active consumer 공존
- deprecated 시스템에 새 기능 추가
- 현재 usage 측정 없이 코드 제거 시도
- active consumer 0 확인 없이 old code 삭제

## Verification

폐기나 migration 작업을 마친 뒤에는 다음을 확인한다.

- [ ] replacement가 production에서 검증됐고 critical use case를 커버한다.
- [ ] concrete migration guide와 예시가 존재한다.
- [ ] active consumer가 모두 이동했다. metrics/logs로 확인했다.
- [ ] old code, 테스트, 문서, 설정이 모두 제거됐다.
- [ ] codebase에 deprecated 시스템 참조가 남지 않았다.
- [ ] deprecation notice도 역할을 마친 뒤 제거됐다.
