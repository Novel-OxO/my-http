---
description: 출시 전 체크리스트 실행 및 프로덕션 배포 준비
---

shipping-and-launch 스킬을 호출합니다.

완전한 출시 전 체크리스트를 점검합니다:

1. **코드 품질(Code Quality)** — 테스트 통과, 빌드 깨끗, 린트 깨끗, TODO 없음, console.log 없음
2. **보안(Security)** — npm audit 깨끗, 코드 내 시크릿 없음, 인증 마련, 헤더 구성
3. **성능(Performance)** — Core Web Vitals 양호, N+1 쿼리 없음, 이미지 최적화, 번들 사이즈 적정
4. **접근성(Accessibility)** — 키보드 내비게이션 동작, 스크린 리더 호환, 충분한 대비
5. **인프라(Infrastructure)** — 환경 변수 설정, 마이그레이션 준비, 모니터링 구성
6. **문서(Documentation)** — README 최신, ADR 작성, 변경 로그 업데이트

실패한 체크를 보고하고 배포 전에 해결을 돕습니다.
진행 전에 롤백 계획을 정의합니다.
