---
name: security-and-hardening
description: 취약점에 강한 코드를 만든다. 사용자 입력, 인증, 민감 데이터, 외부 서비스, 파일 업로드처럼 비신뢰 데이터를 다루는 기능을 만들거나 수정할 때 사용한다.
---

# 보안과 하드닝

## Overview

보안은 나중에 붙이는 단계가 아니라, 외부 입력과 사용자 데이터에 닿는 모든 코드 줄에 걸리는 제약이다. 모든 외부 입력은 적대적일 수 있다고 가정하고, 모든 비밀값은 보호 대상이며, 모든 권한 검사는 필수라고 본다.

## When to Use

- 사용자 입력을 받는 기능을 만들 때
- 인증이나 인가를 구현할 때
- 민감 데이터를 저장하거나 전송할 때
- 외부 API나 서비스와 연동할 때
- 파일 업로드, webhook, callback을 추가할 때
- 결제 정보나 PII를 처리할 때

**When NOT to use:** purely internal computation이고 외부 입력, 인증, 데이터 경계가 전혀 없는 코드에는 과한 절차일 수 있다. 그래도 보안 관련 코드 리뷰 관점은 유지한다.

## The Three-Tier Boundary System

### Always Do

예외 없이 지킨다.

- 모든 외부 입력을 시스템 경계에서 검증한다.
- 모든 DB query는 parameterize한다.
- 출력은 XSS를 막도록 encode/escape한다.
- 모든 외부 통신은 HTTPS를 사용한다.
- 비밀번호는 bcrypt/scrypt/argon2로 hash한다.
- 보안 헤더를 설정한다.
- 세션 쿠키는 `httpOnly`, `secure`, `sameSite`를 사용한다.
- 릴리스 전 `npm audit` 또는 동등한 점검을 실행한다.

### Ask First

사람 승인 없이 진행하지 않는다.

- 새로운 인증 플로우 추가
- auth logic 변경
- 새로운 민감 데이터 범주 저장
- 새로운 외부 서비스 연동
- CORS 설정 변경
- 파일 업로드 처리기 추가
- rate limiting / throttling 변경
- 상위 권한이나 역할 부여

### Never Do

절대 하지 않는다.

- 비밀값을 버전 관리에 커밋
- 민감 데이터 로깅
- client-side validation을 보안 경계로 간주
- 편의 때문에 security header 비활성화
- user input과 함께 `eval()` 또는 `innerHTML` 사용
- 인증 세션을 client-accessible storage에 저장
- 사용자에게 stack trace나 내부 에러 세부정보 노출

## OWASP-Oriented Prevention

### 1. Injection

```typescript
// BAD
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// GOOD
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// GOOD
const user = await prisma.user.findUnique({ where: { id: userId } });
```

SQL만이 아니라 NoSQL, shell command, search query string도 같은 기준으로 본다.

### 2. Broken Authentication

```typescript
import { hash, compare } from 'bcrypt';

const SALT_ROUNDS = 12;
const hashedPassword = await hash(plaintext, SALT_ROUNDS);
const isValid = await compare(plaintext, hashedPassword);
```

세션 예시:

```typescript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));
```

### 3. Cross-Site Scripting (XSS)

```typescript
// BAD
element.innerHTML = userInput;

// GOOD
return <div>{userInput}</div>;
```

HTML 렌더링이 꼭 필요하면 sanitize 후에만 사용한다.

```typescript
import DOMPurify from 'dompurify';

const clean = DOMPurify.sanitize(userInput);
```

### 4. Broken Access Control

인증만으로 끝나지 않는다. **권한 검사**가 필요하다.

```typescript
app.patch('/api/tasks/:id', authenticate, async (req, res) => {
  const task = await taskService.findById(req.params.id);

  if (task.ownerId !== req.user.id) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Not authorized to modify this task',
      },
    });
  }

  const updated = await taskService.update(req.params.id, req.body);
  return res.json(updated);
});
```

모든 protected endpoint는 "누가 로그인했는가?"와 "그 사용자가 이 리소스를 바꿀 권한이 있는가?"를 둘 다 확인해야 한다.

### 5. Security Misconfiguration

보안 헤더와 CORS를 느슨하게 두지 않는다.

```typescript
import helmet from 'helmet';
app.use(helmet());
```

```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
```

`*` wildcard origin은 기본 거부하고, 알려진 origin만 허용한다.

### 6. Sensitive Data Exposure

민감 필드는 API 응답에 실리지 않게 제거한다.

```typescript
function sanitizeUser(user: UserRecord): PublicUser {
  const { passwordHash, resetToken, ...publicFields } = user;
  return publicFields;
}
```

비밀값은 환경 변수에서 읽는다.

```typescript
const API_KEY = process.env.STRIPE_API_KEY;
if (!API_KEY) throw new Error('STRIPE_API_KEY not configured');
```

## Input Validation Patterns

검증은 경계에서 수행한다.

```typescript
import { z } from 'zod';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().datetime().optional(),
});
```

```typescript
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: result.error.flatten(),
      },
    });
  }

  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

경계 밖에서는 검증을 중복하지 않는다. 검증된 타입을 신뢰한다.

## File Upload Safety

파일 업로드는 type, size, 내용 모두 위험 표면이다.

```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

function validateUpload(file: UploadedFile) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new ValidationError('File type not allowed');
  }

  if (file.size > MAX_SIZE) {
    throw new ValidationError('File too large (max 5MB)');
  }
}
```

확장자는 신뢰하지 않는다. 중요하면 magic byte도 확인한다.

## Triaging `npm audit`

모든 취약점이 같은 급의 긴급도는 아니다. reachable 여부와 runtime exposure를 같이 본다.

```text
Critical / High
├── production reachable → 즉시 수정
└── dev-only or unreachable → 빠르게 수정, 기록 남김

Moderate
├── production reachable → 다음 릴리스 사이클 내 수정
└── dev-only → backlog 추적

Low
└── 정기 dependency update 때 처리
```

미루는 경우에는 이유와 재검토 날짜를 문서화한다.

## Rate Limiting

인증 endpoint는 더 강하게 제한한다.

```typescript
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
}));
```

## Secrets Management

`.env` 정책을 명확히 유지한다.

```text
.env.example  → 커밋 가능, placeholder만
.env          → 커밋 금지
.env.local    → 커밋 금지
.env.*.local  → 커밋 금지
*.pem, *.key  → 커밋 금지
```

커밋 전에는 staged diff를 확인한다.

```bash
git diff --cached | grep -i "password\\|secret\\|api_key\\|token"
```

## Security Review Checklist

### Authentication

- [ ] 비밀번호 hash 적용
- [ ] session token이 `httpOnly`, `secure`, `sameSite`
- [ ] 로그인 endpoint에 rate limiting 존재
- [ ] reset token 만료 처리

### Authorization

- [ ] 모든 protected endpoint가 권한 검사
- [ ] 사용자가 자기 리소스만 접근 가능
- [ ] admin action은 admin role 확인

### Input

- [ ] 모든 사용자 입력이 경계에서 검증됨
- [ ] SQL query parameterized
- [ ] HTML output encode/escape

### Data

- [ ] 코드와 git history에 secret 없음
- [ ] API 응답에서 민감 필드 제거
- [ ] 필요한 경우 PII at-rest encryption

### Infrastructure

- [ ] security header 설정
- [ ] CORS가 known origin으로 제한
- [ ] dependency vulnerability audit 완료
- [ ] 사용자 에러 메시지가 내부 정보를 노출하지 않음

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "이건 내부 도구라서 보안이 덜 중요하다" | 내부 도구도 공격 대상이다. 약한 고리가 먼저 뚫린다. |
| "보안은 나중에 붙이면 된다" | 보안 레트로핏은 처음부터 넣는 것보다 훨씬 비싸다. |
| "누가 이런 걸 공격하겠어" | 자동 스캐너는 그런 가정을 존중하지 않는다. |
| "프레임워크가 알아서 해 준다" | 프레임워크는 도구를 줄 뿐, 안전한 사용까지 대신하지는 않는다. |
| "프로토타입일 뿐이다" | 프로토타입은 자주 프로덕션이 된다. 초반 습관이 그대로 남는다. |

## Red Flags

- 사용자 입력이 query, shell command, HTML 렌더링에 바로 들어가는 경우
- 코드나 commit history에 secret이 남는 경우
- 인증/인가 검사 없는 API endpoint
- wildcard CORS나 느슨한 origin 정책
- auth endpoint에 rate limit이 없는 경우
- 사용자에게 stack trace나 내부 에러를 그대로 노출하는 경우
- critical vulnerability가 알려진 dependency를 그대로 두는 경우

## Verification

보안 관련 코드를 구현하거나 수정한 뒤에는 다음을 확인한다.

- [ ] `npm audit`에 critical/high 취약점이 남지 않았거나, 남았다면 reachable 여부와 처리 계획이 문서화돼 있다.
- [ ] 코드와 git history에 secret이 없다.
- [ ] 모든 사용자 입력이 시스템 경계에서 검증된다.
- [ ] 모든 protected endpoint에 authentication과 authorization이 있다.
- [ ] 응답에 security header가 존재한다. 필요하면 브라우저 DevTools로 확인했다.
- [ ] 에러 응답이 내부 세부정보를 노출하지 않는다.
- [ ] auth endpoint에 rate limiting이 적용돼 있다.
