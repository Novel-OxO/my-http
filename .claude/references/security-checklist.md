# 보안 체크리스트

웹 애플리케이션 보안을 위한 빠른 참조. `security-and-hardening` 스킬과 함께 사용합니다.

## 목차

- [커밋 전 체크](#커밋-전-체크)
- [인증](#인증)
- [인가](#인가)
- [입력 검증](#입력-검증)
- [보안 헤더](#보안-헤더)
- [CORS 설정](#cors-설정)
- [데이터 보호](#데이터-보호)
- [의존성 보안](#의존성-보안)
- [에러 처리](#에러-처리)
- [OWASP Top 10 빠른 참조](#owasp-top-10-빠른-참조)

## 커밋 전 체크

- [ ] 코드에 시크릿 없음 (`git diff --cached | grep -i "password\|secret\|api_key\|token"`)
- [ ] `.gitignore`에 포함: `.env`, `.env.local`, `*.pem`, `*.key`
- [ ] `.env.example`은 플레이스홀더 값 사용 (실제 시크릿 아님)

## 인증

- [ ] 비밀번호는 bcrypt (≥12 rounds), scrypt, argon2로 해싱
- [ ] 세션 쿠키: `httpOnly`, `secure`, `sameSite: 'lax'`
- [ ] 세션 만료 설정 (합리적인 max-age)
- [ ] 로그인 엔드포인트에 Rate limiting (15분당 ≤10회 시도)
- [ ] 비밀번호 재설정 토큰: 시간 제한 (≤1시간), 일회용
- [ ] 반복 실패 시 계정 잠금 (선택, 알림 포함)
- [ ] 민감한 작업에 MFA 지원 (선택, 권장)

## 인가

- [ ] 모든 보호된 엔드포인트가 인증 확인
- [ ] 모든 리소스 접근이 소유권/역할 확인 (IDOR 방지)
- [ ] 관리자 엔드포인트는 관리자 역할 검증 필요
- [ ] API 키는 필요한 최소 권한으로 범위 지정
- [ ] JWT 토큰 검증 (시그니처, 만료, 발행자)

## 입력 검증

- [ ] 모든 사용자 입력을 시스템 경계에서 검증 (API 라우트, 폼 핸들러)
- [ ] 검증은 허용 목록 사용 (차단 목록 아님)
- [ ] 문자열 길이 제한 (최소/최대)
- [ ] 숫자 범위 검증
- [ ] Email, URL, 날짜 형식을 적절한 라이브러리로 검증
- [ ] 파일 업로드: 타입 제한, 사이즈 제한, 내용 검증
- [ ] SQL 쿼리 파라미터화 (문자열 연결 금지)
- [ ] HTML 출력 인코딩 (프레임워크 자동 이스케이핑 사용)
- [ ] 리다이렉트 전 URL 검증 (오픈 리다이렉트 방지)

## 보안 헤더

```
Content-Security-Policy: default-src 'self'; script-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0  (비활성화, CSP에 의존)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## CORS 설정

```typescript
// 제한적 (권장)
cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// 프로덕션에서 절대 사용 금지:
cors({ origin: '*' })  // 모든 오리진 허용
```

## 데이터 보호

- [ ] 민감 필드를 API 응답에서 제외 (`passwordHash`, `resetToken` 등)
- [ ] 민감 데이터 로깅 금지 (비밀번호, 토큰, 전체 카드 번호)
- [ ] PII 저장 시 암호화 (규제 요구 시)
- [ ] 모든 외부 통신에 HTTPS
- [ ] 데이터베이스 백업 암호화

## 의존성 보안

```bash
# 의존성 감사
npm audit

# 가능한 곳은 자동 수정
npm audit fix

# 크리티컬 취약점 확인
npm audit --audit-level=critical

# 의존성 최신화 유지
npx npm-check-updates
```

## 에러 처리

```typescript
// 프로덕션: 일반 에러, 내부 정보 없음
res.status(500).json({
  error: { code: 'INTERNAL_ERROR', message: '문제가 발생했습니다' }
});

// 프로덕션에서 절대 금지:
res.status(500).json({
  error: err.message,
  stack: err.stack,         // 내부 노출
  query: err.sql,           // DB 세부 노출
});
```

## OWASP Top 10 빠른 참조

| # | 취약점 | 예방 |
|---|---|---|
| 1 | Broken Access Control | 모든 엔드포인트 인증 체크, 소유권 검증 |
| 2 | Cryptographic Failures | HTTPS, 강력한 해싱, 코드에 시크릿 없음 |
| 3 | Injection | 파라미터화 쿼리, 입력 검증 |
| 4 | Insecure Design | 위협 모델링, 스펙 주도 개발 |
| 5 | Security Misconfiguration | 보안 헤더, 최소 권한, 의존성 감사 |
| 6 | Vulnerable Components | `npm audit`, 의존성 최신화, 의존성 최소화 |
| 7 | Auth Failures | 강한 비밀번호, rate limiting, 세션 관리 |
| 8 | Data Integrity Failures | 업데이트/의존성 검증, 서명된 아티팩트 |
| 9 | Logging Failures | 보안 이벤트 로깅, 시크릿 로깅 금지 |
| 10 | SSRF | URL 검증/허용 목록, 아웃바운드 요청 제한 |
