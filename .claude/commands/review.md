---
description: 다섯 축(정확성, 가독성, 아키텍처, 보안, 성능)의 코드 리뷰 수행
---

code-review-and-quality 스킬을 호출합니다.

현재 변경사항(스테이징된 것 또는 최근 커밋)을 다섯 축에 걸쳐 리뷰합니다:

1. **정확성(Correctness)** — 스펙과 일치하는가? 엣지 케이스를 처리하는가? 테스트가 충분한가?
2. **가독성(Readability)** — 명확한 이름인가? 로직이 직관적인가? 잘 정리되었는가?
3. **아키텍처(Architecture)** — 기존 패턴을 따르는가? 경계가 깔끔한가? 적절한 추상화 수준인가?
4. **보안(Security)** — 입력이 검증되었는가? 시크릿이 안전한가? 인증이 확인되었는가? (security-and-hardening 스킬 사용)
5. **성능(Performance)** — N+1 쿼리가 없는가? 제한 없는 연산이 없는가? (performance-optimization 스킬 사용)

발견 사항을 Critical(치명적), Important(중요), Suggestion(제안) 으로 분류합니다.
구체적인 file:line 참조와 수정 권고를 포함한 구조화된 리뷰를 출력합니다.
