# 접근성 체크리스트

WCAG 2.1 AA 준수를 위한 빠른 참조. `frontend-ui-engineering` 스킬과 함께 사용합니다.

## 목차

- [필수 체크 항목](#필수-체크-항목)
- [일반적인 HTML 패턴](#일반적인-html-패턴)
- [테스트 도구](#테스트-도구)
- [빠른 참조: ARIA Live Regions](#빠른-참조-aria-live-regions)
- [흔한 안티 패턴](#흔한-안티-패턴)

## 필수 체크 항목

### 키보드 내비게이션
- [ ] 모든 인터랙티브 요소가 Tab 키로 포커스 가능
- [ ] 포커스 순서가 시각적/논리적 순서를 따름
- [ ] 포커스가 보임 (포커스된 요소에 outline/ring)
- [ ] 커스텀 위젯에 키보드 지원 (Enter로 활성화, Escape로 닫기)
- [ ] 키보드 트랩 없음 (사용자가 항상 컴포넌트에서 Tab으로 빠져나올 수 있음)
- [ ] 페이지 상단에 skip-to-content 링크 — 최소한 키보드 포커스 시 표시
- [ ] 모달은 열린 동안 포커스를 가두고, 닫힐 때 포커스를 복귀

### 스크린 리더
- [ ] 모든 이미지에 `alt` 텍스트 (장식용 이미지는 `alt=""`)
- [ ] 모든 폼 입력에 연관된 레이블 (`<label>` 또는 `aria-label`)
- [ ] 버튼과 링크에 설명적 텍스트 ("여기 클릭" 금지)
- [ ] 아이콘 전용 버튼에 `aria-label`
- [ ] 페이지에 하나의 `<h1>`, 헤딩이 레벨을 건너뛰지 않음
- [ ] 동적 콘텐츠 변경이 안내됨 (`aria-live` 영역)
- [ ] 테이블에 scope 속성이 있는 `<th>` 헤더

### 시각
- [ ] 텍스트 대비 ≥ 4.5:1 (일반 텍스트) 또는 ≥ 3:1 (18px+ 큰 텍스트)
- [ ] UI 컴포넌트 대비가 배경 대비 ≥ 3:1
- [ ] 색상이 정보 전달의 유일한 수단이 아님
- [ ] 레이아웃이 깨지지 않고 텍스트를 200%까지 리사이즈 가능
- [ ] 초당 3회 이상 깜빡이는 콘텐츠 없음

### 폼
- [ ] 모든 입력에 보이는 레이블
- [ ] 필수 필드 표시 (색상만으로는 안 됨)
- [ ] 에러 메시지가 구체적이고 필드와 연관됨
- [ ] 에러 상태가 색상 외에 다른 방식으로도 보임 (아이콘, 텍스트, 테두리)
- [ ] 폼 제출 에러가 요약되고 포커스 가능
- [ ] 알려진 필드는 autocomplete 사용 (예: `type="email" autocomplete="email"`)

### 콘텐츠
- [ ] 언어 선언 (`<html lang="ko">`)
- [ ] 페이지에 설명적인 `<title>`
- [ ] 링크가 주변 텍스트와 구분됨 (색상만으로는 안 됨)
- [ ] 모바일 터치 타겟 ≥ 44x44px
- [ ] 의미 있는 빈 상태 (빈 화면 금지)

## 일반적인 HTML 패턴

### 버튼 vs 링크

```html
<!-- 동작에는 <button> 사용 -->
<button onClick={handleDelete}>태스크 삭제</button>

<!-- 내비게이션에는 <a> 사용 -->
<a href="/tasks/123">태스크 보기</a>

<!-- div/span을 버튼으로 쓰지 말 것 -->
<div onClick={handleDelete}>삭제</div>  <!-- BAD -->
```

### 폼 레이블

```html
<!-- 명시적 레이블 연관 -->
<label htmlFor="email">이메일 주소</label>
<input id="email" type="email" required />

<!-- 암묵적 래핑 -->
<label>
  이메일 주소
  <input type="email" required />
</label>

<!-- 숨겨진 레이블 (보이는 레이블이 선호됨) -->
<input type="search" aria-label="태스크 검색" />
```

### ARIA 역할

```html
<!-- 내비게이션 -->
<nav aria-label="메인 내비게이션">...</nav>
<nav aria-label="푸터 링크">...</nav>

<!-- 상태 메시지 -->
<div role="status" aria-live="polite">태스크가 저장됨</div>

<!-- 경고 메시지 -->
<div role="alert">에러: 제목이 필요합니다</div>

<!-- 모달 다이얼로그 -->
<dialog aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">삭제 확인</h2>
  ...
</dialog>

<!-- 로딩 상태 -->
<div aria-busy="true" aria-label="태스크 로드 중">
  <Spinner />
</div>
```

### 접근 가능한 리스트

```html
<ul role="list" aria-label="태스크">
  <li>
    <input type="checkbox" id="task-1" aria-label="완료: 장보기" />
    <label htmlFor="task-1">장보기</label>
  </li>
</ul>
```

## 테스트 도구

```bash
# 자동화된 감사
npx axe-core          # 프로그래매틱 접근성 테스트
npx pa11y             # CLI 접근성 체커

# 브라우저에서
# Chrome DevTools → Lighthouse → Accessibility
# Chrome DevTools → Elements → Accessibility tree

# 스크린 리더 테스트
# macOS: VoiceOver (Cmd + F5)
# Windows: NVDA (무료) 또는 JAWS
# Linux: Orca
```

## 빠른 참조: ARIA Live Regions

| 값 | 동작 | 용도 |
|----|------|------|
| `aria-live="polite"` | 다음 쉬는 시점에 안내 | 상태 업데이트, 저장 확인 |
| `aria-live="assertive"` | 즉시 안내 | 에러, 시간 민감 경고 |
| `role="status"` | `polite`와 동일 | 상태 메시지 |
| `role="alert"` | `assertive`와 동일 | 에러 메시지 |

## 흔한 안티 패턴

| 안티 패턴 | 문제점 | 해결 |
|---|---|---|
| 버튼으로 사용된 div | 포커스 불가, 키보드 지원 없음 | `<button>` 사용 |
| 누락된 `alt` 텍스트 | 스크린 리더에서 이미지 안 보임 | 설명적 `alt` 추가 |
| 색상 전용 상태 표시 | 색맹 사용자에게 안 보임 | 아이콘, 텍스트, 패턴 추가 |
| 자동 재생 미디어 | 혼란스럽고 멈출 수 없음 | 컨트롤 추가, 자동재생 금지 |
| ARIA 없는 커스텀 드롭다운 | 키보드/스크린 리더 사용 불가 | 네이티브 `<select>` 또는 적절한 ARIA listbox 사용 |
| 포커스 outline 제거 | 사용자가 어디 있는지 모름 | 제거하지 말고 스타일링 |
| 빈 링크/버튼 | 설명 없이 "Link"만 안내됨 | 텍스트 또는 `aria-label` 추가 |
| `tabindex > 0` | 자연스러운 탭 순서를 깸 | `tabindex="0"` 또는 `-1`만 사용 |
