---
name: shipping-and-launch
description: 프로덕션 출시를 준비한다. 운영 배포를 앞두고 있을 때, 출시 전 체크리스트와 모니터링, 점진적 롤아웃, 롤백 전략을 준비해야 할 때 사용한다.
---

# 배포와 출시

## Overview

배포의 목표는 단순히 코드를 올리는 것이 아니라, 안전하게 올리고 이상 징후를 즉시 감지하고 되돌릴 수 있게 만드는 것이다. 좋은 출시는 세 가지 조건을 만족한다.

- 되돌릴 수 있고
- 관측 가능하고
- 점진적으로 확대된다

한 번의 deploy가 성공했다고 출시가 끝난 게 아니다. 운영에서 실제로 안전한지 확인하는 관찰 구간까지 포함해야 한다.

## When to Use

- 기능을 처음으로 프로덕션에 배포할 때
- 사용자 영향이 큰 변경을 릴리스할 때
- 데이터나 인프라를 이전할 때
- beta, early access, canary를 열 때
- 리스크가 있는 모든 배포를 할 때

## 출시 전 체크리스트

### Code Quality

- [ ] unit, integration, e2e 테스트가 모두 통과한다
- [ ] build가 경고 없이 성공한다
- [ ] lint와 type check가 통과한다
- [ ] 코드 리뷰가 끝났다
- [ ] 출시 전에 처리해야 할 TODO가 남아 있지 않다
- [ ] 프로덕션 코드에 `console.log` 디버깅 흔적이 없다
- [ ] 예상 가능한 failure mode에 대한 에러 처리가 있다

### Security

- [ ] 코드나 버전 관리에 비밀 정보가 없다
- [ ] high/critical 취약점이 남아 있지 않다
- [ ] 모든 사용자 입력 경계에 검증이 있다
- [ ] 인증과 인가가 필요한 지점에 적용돼 있다
- [ ] CSP, HSTS 등 필요한 security header가 설정돼 있다
- [ ] 인증 엔드포인트에 rate limiting이 있다
- [ ] CORS가 wildcard가 아니라 필요한 origin만 허용한다

### Performance

- [ ] 핵심 사용자 흐름의 성능 budget이 기준 안에 있다
- [ ] critical path에 N+1 query가 없다
- [ ] 이미지와 정적 자산이 최적화돼 있다
- [ ] bundle size가 budget 안에 있다
- [ ] 주요 DB query에 적절한 index가 있다
- [ ] cache 정책이 필요한 자산과 query에 설정돼 있다

### Accessibility

- [ ] 모든 상호작용 요소에 keyboard navigation이 된다
- [ ] screen reader가 구조와 콘텐츠를 전달할 수 있다
- [ ] color contrast가 WCAG 2.1 AA를 충족한다
- [ ] modal과 dynamic content의 focus 관리가 맞다
- [ ] 오류 메시지가 충분히 구체적이고 필드와 연결된다
- [ ] axe-core나 Lighthouse 접근성 경고가 남아 있지 않다

### Infrastructure

- [ ] 프로덕션 환경 변수와 secret이 설정돼 있다
- [ ] 필요한 migration이 준비되었거나 적용됐다
- [ ] DNS와 SSL이 올바르게 설정돼 있다
- [ ] CDN과 static asset delivery가 준비돼 있다
- [ ] 로그와 에러 리포팅이 연결돼 있다
- [ ] health check endpoint가 존재하고 응답한다

### Documentation

- [ ] 새 setup 요구사항이 있으면 README가 갱신됐다
- [ ] API 문서가 현재 구현과 맞다
- [ ] 설계 결정이 있으면 `documentation-and-adrs` 기준으로 ADR이 작성됐다
- [ ] changelog나 release note가 갱신됐다
- [ ] 사용자 문서가 필요한 경우 함께 업데이트됐다

## Feature Flag Strategy

배포와 릴리스를 분리한다. 코드는 먼저 production에 올리고, 기능 노출은 flag로 제어한다.

```typescript
const flags = await getFeatureFlags(userId);

if (flags.taskSharing) {
  return renderTaskSharing();
}

return renderCurrentExperience();
```

### Feature Flag Lifecycle

```text
1. DEPLOY with flag OFF   → 코드는 production에 있지만 비활성
2. ENABLE for team/beta   → 내부 또는 제한된 사용자로 검증
3. GRADUAL ROLLOUT        → 5% → 25% → 50% → 100%
4. MONITOR each stage     → 오류율, 지연 시간, 사용자 피드백 확인
5. CLEAN UP               → 전체 rollout 후 flag와 dead code 제거
```

규칙:

- 모든 feature flag에는 owner와 만료 시점이 있다
- 전체 rollout 후 2주 안에 flag 정리를 시작한다
- feature flag를 중첩해서 조합 폭발을 만들지 않는다
- CI에서 flag ON/OFF 두 상태를 모두 테스트한다

## 단계적 롤아웃

### Rollout Sequence

```text
1. DEPLOY to staging
   └── staging 환경에서 전체 테스트와 smoke test 실행

2. DEPLOY to production (flag OFF)
   └── health check, error dashboard, log flow 확인

3. ENABLE for team
   └── 내부 사용자가 실제 운영 환경에서 사용
   └── 최소 24시간 관찰

4. CANARY rollout (예: 5%)
   └── 오류율, latency, business metric 비교
   └── 기준 통과 시에만 다음 단계로 진행

5. GRADUAL increase (25% → 50% → 100%)
   └── 각 단계마다 동일한 관찰과 판단 반복

6. FULL rollout
   └── 최소 1주일 모니터링 후 flag 정리
```

### Rollout Decision Thresholds

| Metric | Advance | Hold and investigate | Roll back |
|---|---|---|---|
| Error rate | baseline 대비 10% 이내 | 10~100% 증가 | 2배 초과 |
| P95 latency | baseline 대비 20% 이내 | 20~50% 증가 | 50% 초과 |
| Client JS errors | 새로운 오류 타입 없음 | 세션 0.1% 미만에서 새 오류 | 세션 0.1% 이상에서 새 오류 |
| Business metrics | 중립 또는 개선 | 5% 미만 하락 | 5% 초과 하락 |

### 언제 롤백하는가

아래 조건이면 즉시 되돌린다.

- 오류율이 baseline의 2배를 넘는다
- P95 latency가 50% 넘게 악화된다
- 사용자 제보가 급증한다
- 데이터 정합성 문제가 감지된다
- 보안 취약점이 발견된다

## 모니터링과 관측성

### 무엇을 모니터링하는가

```text
Application metrics
├── 전체/엔드포인트별 error rate
├── p50, p95, p99 response time
├── request volume
├── active users
└── business metrics (conversion, engagement)

Infrastructure metrics
├── CPU / memory
├── database connection pool
├── disk space
├── network latency
└── queue depth

Client metrics
├── Core Web Vitals
├── JavaScript errors
├── client 관점 API error rate
└── page load time
```

### Error Reporting

```typescript
class ErrorBoundary extends React.Component<Props, { hasError: boolean }> {
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, {
      componentStack: info.componentStack,
      userId: getCurrentUser()?.id,
      page: window.location.pathname,
    });
  }

  render() {
    if (this.state.hasError) {
      return <FallbackScreen onRetry={() => this.setState({ hasError: false })} />;
    }

    return this.props.children;
  }
}

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  reportError(err, {
    method: req.method,
    url: req.url,
    userId: req.user?.id,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    },
  });
});
```

핵심은 내부 진단 정보는 모니터링 시스템으로 보내고, 사용자에게는 안전한 오류 표면만 노출하는 것이다.

### 출시 직후 1시간 검증

```text
1. health endpoint가 200을 반환하는지 확인
2. error dashboard에 새로운 오류 타입이 없는지 확인
3. latency dashboard에 회귀가 없는지 확인
4. 핵심 사용자 흐름을 수동으로 직접 실행
5. 로그가 정상적으로 들어오는지 확인
6. rollback 절차가 실제로 준비돼 있는지 확인
```

## 롤백 전략

모든 배포는 시작 전에 롤백 계획을 갖고 있어야 한다.

```markdown
## Rollback Plan for [Feature/Release]

### Trigger Conditions
- Error rate > 2x baseline
- P95 latency > [X]ms
- 사용자에게 [특정 증상]이 재현됨

### Rollback Steps
1. feature flag 비활성화 (가능한 경우)
2. 이전 변경을 `git revert <commit>`로 되돌리거나 직전 안정 버전 재배포
3. health check와 error dashboard로 복구 확인
4. 팀에 rollback 사실과 영향 범위를 공유

### Database Considerations
- migration [X]의 rollback 가능 여부
- 새 기능이 쓴 데이터의 보존/정리 방침

### Time to Rollback
- Feature flag off: 1분 이내
- 이전 버전 재배포: 5분 이내
- database rollback: 15분 이내
```

DB rollback이 불가능하거나 비가역적이면, 출시 전에 forward-fix 경로와 데이터 보존 정책을 분명히 적어 둔다.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "staging에서 됐으니 production에서도 된다" | production은 데이터, 트래픽, edge case가 다르다. deploy 뒤에도 계속 봐야 한다. |
| "이번 건은 feature flag까지는 필요 없다" | kill switch가 있으면 작은 변경도 더 안전하게 낼 수 있다. |
| "모니터링은 나중에 붙이자" | 보이지 않으면 문제를 대시보드가 아니라 사용자 불만으로 처음 알게 된다. |
| "rollback은 실패를 인정하는 거다" | rollback은 책임 있는 엔지니어링이다. 깨진 기능을 계속 노출하는 쪽이 실패다. |
| "금요일 오후지만 이번 배포는 간단하다" | 위험이 없는 배포는 없다. 지원 인력이 없는 시간대 배포는 기준을 더 높여야 한다. |

## Red Flags

- 롤백 계획 없이 배포한다
- 프로덕션에 모니터링이나 에러 리포팅이 없다
- staging 없이 한 번에 전부 내보내는 big-bang release를 한다
- owner와 만료일 없는 feature flag가 쌓인다
- 배포 후 첫 1시간을 아무도 보지 않는다
- 운영 환경 설정이 코드가 아니라 개인 기억에 의존한다
- "작은 변경이니 괜찮다"는 말로 검증을 줄인다

## Verification

배포 전:

- [ ] 출시 전 체크리스트를 전부 통과했다
- [ ] feature flag가 필요하면 설정과 owner가 준비됐다
- [ ] rollback plan이 문서화돼 있다
- [ ] monitoring dashboard와 alert가 준비됐다
- [ ] 배포 시간과 책임자가 팀에 공유됐다

배포 후:

- [ ] health check가 200을 반환한다
- [ ] error rate가 정상 범위다
- [ ] latency가 정상 범위다
- [ ] 핵심 사용자 흐름이 동작한다
- [ ] 로그와 tracing이 정상적으로 수집된다
- [ ] rollback이 실제로 가능한 상태인지 확인했다
