# 성능 체크리스트

웹 애플리케이션 성능을 위한 빠른 참조 체크리스트. `performance-optimization` 스킬과 함께 사용합니다.

## 목차

- [Core Web Vitals 목표](#core-web-vitals-목표)
- [TTFB 진단](#ttfb-진단)
- [프론트엔드 체크리스트](#프론트엔드-체크리스트)
- [백엔드 체크리스트](#백엔드-체크리스트)
- [측정 커맨드](#측정-커맨드)
- [흔한 안티 패턴](#흔한-안티-패턴)

## Core Web Vitals 목표

| 지표 | 양호 | 개선 필요 | 불량 |
|------|------|-----------|------|
| LCP (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| INP (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |

## TTFB 진단

TTFB가 느릴 때 (> 800ms), DevTools Network waterfall에서 각 구성 요소를 확인:

- [ ] **DNS 해결** 느림 → 알려진 오리진에 `<link rel="dns-prefetch">` 또는 `<link rel="preconnect">` 추가
- [ ] **TCP/TLS 핸드셰이크** 느림 → HTTP/2 활성화, 엣지 배포 고려, keep-alive 확인
- [ ] **서버 처리** 느림 → 백엔드 프로파일, 느린 쿼리 확인, 캐싱 추가

## 프론트엔드 체크리스트

### 이미지
- [ ] 현대적 포맷 사용 (WebP, AVIF)
- [ ] 반응형 사이즈 (`srcset` 및 `sizes`)
- [ ] 이미지와 `<source>` 요소에 명시적인 `width`/`height` (아트 디렉션에서 CLS 방지)
- [ ] 화면 아래 이미지에 `loading="lazy"`와 `decoding="async"`
- [ ] 히어로/LCP 이미지에 `fetchpriority="high"`, lazy 로딩 없음

### JavaScript
- [ ] 번들 사이즈 gzip 후 200KB 이하 (초기 로드)
- [ ] 라우트 및 무거운 기능에 동적 `import()`로 코드 스플리팅
- [ ] 트리 쉐이킹 활성화 (의존성이 ESM을 제공하고 `sideEffects: false` 표기 확인)
- [ ] `<head>`에 블로킹 JavaScript 없음 (`defer` 또는 `async` 사용)
- [ ] 무거운 계산은 Web Worker로 오프로드 (해당 시)
- [ ] 같은 props로 리렌더되는 비싼 컴포넌트에 `React.memo()`
- [ ] `useMemo()` / `useCallback()`은 프로파일링으로 이득이 확인된 곳에만
- [ ] 긴 태스크(> 50ms)를 분할해 메인 스레드를 확보 — INP의 주요 지렛대
- [ ] 오래 도는 루프 안에서 `yieldToMain` 패턴 사용해 입력 이벤트가 청크 사이에 실행되게 함
- [ ] 사용 가능한 현대적 스케줄링 API 활용: `scheduler.yield()` (우선), `scheduler.postTask()` + priorities, 필요시에만 양보하는 `isInputPending()`
- [ ] 지연 가능한 비긴급 작업(애널리틱스 flush, prefetch, 워밍업)에 `requestIdleCallback`
- [ ] 서드파티 스크립트는 `async`/`defer`로 로드, 사이즈 감사, 무거운 경우(챗 위젯, 임베드) facade로 감쌈

### CSS
- [ ] Critical CSS 인라인 또는 preload
- [ ] 비크리티컬 스타일에 렌더 블로킹 CSS 없음
- [ ] 프로덕션에서 CSS-in-JS 런타임 비용 없음 (추출 사용)

### 폰트
- [ ] 폰트 패밀리 2–3개로 제한, 각 weight 2–3개 (weight마다 요청 추가)
- [ ] WOFF2 포맷만 (가장 작고 보편적 — WOFF/TTF/EOT 제외)
- [ ] 가능하면 셀프 호스팅 (서드파티 폰트 CDN은 DNS + TCP + TLS 왕복 추가)
- [ ] LCP 중요 폰트 preload: `<link rel="preload" as="font" type="font/woff2" crossorigin>`
- [ ] `font-display: swap` (또는 비크리티컬에 `optional`)로 FOIT 렌더 블로킹 방지
- [ ] 페이지가 필요한 글리프만 제공하도록 `unicode-range`로 서브셋팅
- [ ] 여러 weight/style이 필요하면 가변 폰트 고려 (파일 하나로 여러 개 대체)
- [ ] 폰트 스왑 시 CLS 감소를 위해 폴백 폰트 메트릭을 `size-adjust`, `ascent-override`, `descent-override`로 조정
- [ ] 커스텀 폰트 전에 시스템 폰트 스택 고려

### 네트워크
- [ ] 정적 자산에 긴 `max-age` + 콘텐츠 해싱 캐싱
- [ ] 적절한 곳에 API 응답 캐싱 (`Cache-Control`)
- [ ] HTTP/2 또는 HTTP/3 활성화
- [ ] 알려진 오리진에 리소스 preconnect (`<link rel="preconnect">`)
- [ ] 이미지 외에도 중요한 리소스에 `fetchpriority` 사용 (예: 핵심 `<link rel="preload">`, 화면 상단 `<script>`)
- [ ] 불필요한 리다이렉트 없음

### 렌더링
- [ ] 레이아웃 스래싱 없음 (강제 동기 레이아웃)
- [ ] 애니메이션에 `transform`과 `opacity` 사용 (GPU 가속)
- [ ] 긴 리스트에 가상화 (예: `react-window`)
- [ ] 불필요한 전체 페이지 리렌더 없음
- [ ] 화면 밖 섹션에 `content-visibility: auto` + `contain-intrinsic-size` 사용해 비가시 영역의 레이아웃/페인트 생략
- [ ] HTML 응답에 `unload` 이벤트 핸들러 없음, `Cache-Control: no-store` 없음 — bfcache 자격 보존

## 백엔드 체크리스트

### 데이터베이스
- [ ] N+1 쿼리 패턴 없음 (eager loading / joins 사용)
- [ ] 쿼리에 적절한 인덱스
- [ ] 리스트 엔드포인트 페이지네이션 (절대 `SELECT * FROM table` 금지)
- [ ] 커넥션 풀링 구성
- [ ] 슬로우 쿼리 로깅 활성화

### API
- [ ] 응답 시간 < 200ms (p95)
- [ ] 요청 핸들러에 동기 무거운 계산 없음
- [ ] 개별 호출 루프 대신 벌크 연산
- [ ] 응답 압축 (gzip/brotli)
- [ ] 적절한 캐싱 (인메모리, Redis, CDN)

### 인프라
- [ ] 정적 자산용 CDN
- [ ] 사용자와 가까운 서버 위치 (또는 엣지 배포)
- [ ] 수평 확장 구성 (필요 시)
- [ ] 로드 밸런서용 헬스 체크 엔드포인트

## 측정 커맨드

```bash
# Lighthouse CLI
npx lighthouse https://localhost:3000 --output json --output-path ./report.json

# 번들 분석
npx webpack-bundle-analyzer stats.json
# 또는 Vite:
npx vite-bundle-visualizer

# 번들 사이즈 체크
npx bundlesize

# 코드 내 Web Vitals
import { onLCP, onINP, onCLS } from 'web-vitals';
onLCP(console.log);
onINP(console.log);
onCLS(console.log);
```

## 흔한 안티 패턴

| 안티 패턴 | 영향 | 해결 |
|---|---|---|
| N+1 쿼리 | 선형 DB 부하 증가 | joins, includes, 배치 로딩 사용 |
| 제한 없는 쿼리 | 메모리 고갈, 타임아웃 | 항상 페이지네이션, LIMIT 추가 |
| 누락된 인덱스 | 데이터 증가 시 느린 읽기 | 필터/정렬 컬럼에 인덱스 추가 |
| 레이아웃 스래싱 | 잰크, 프레임 드롭 | DOM 읽기 배치, 쓰기 배치 |
| 최적화 안 된 이미지 | 느린 LCP, 대역폭 낭비 | WebP, 반응형 사이즈, lazy 로드 |
| 큰 번들 | 느린 Time to Interactive | 코드 스플리팅, 트리 쉐이킹, 의존성 감사 |
| 메인 스레드 블로킹 | 나쁜 INP, 반응 없는 UI | `scheduler.yield()`/`yieldToMain`으로 청킹, Web Worker로 오프로드 |
| 메모리 누수 | 메모리 증가, 결국 크래시 | 리스너, 인터벌, 레퍼런스 정리 |
