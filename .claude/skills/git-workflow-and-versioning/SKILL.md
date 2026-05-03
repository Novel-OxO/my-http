---
name: git-workflow-and-versioning
description: Git 작업 흐름을 구조화한다. 코드 변경을 커밋·브랜치·히스토리 단위로 정리해야 할 때, 병렬 작업과 변경 범위를 안전하게 관리해야 할 때 사용한다.
---

# Git 워크플로와 버전 관리

## Overview

Git은 안전망이다. 커밋은 save point, 브랜치는 sandbox, 히스토리는 문서라고 생각한다. 에이전트가 빠른 속도로 코드를 만들수록, version control 규율이 없으면 변경은 금방 관리 불가능해진다.

핵심은 세 가지다.

- 작게 나누고
- 자주 저장하고
- 왜 바꿨는지 남긴다

## When to Use

항상. 모든 코드 변경은 git 흐름 안에서 관리한다.

## Core Principles

### Trunk-Based Development (Recommended)

기본 추천은 `main`을 항상 배포 가능한 상태로 유지하고, 1~3일 안에 머지되는 짧은 feature branch에서 작업하는 방식이다.

```text
main ──●──●──●──●──●──●──●──●──●──
   ╲ ╱   ╲ ╱
    ●──●─╱  ●──╱   ← short-lived feature branches
```

원칙:

- dev branch는 오래 살수록 비용이다.
- release branch는 예외적으로 허용 가능하다.
- 오래 사는 branch보다 feature flag가 낫다.
- 특정 branching model보다 commit discipline이 더 중요하다.

### 1. Commit Early, Commit Often

성공한 increment마다 커밋한다.

```text
Implement slice → Test → Verify → Commit → Next slice
```

하지 말 것:

```text
기능 전체 구현 → 잘 되길 기대 → 거대한 커밋 1개
```

커밋은 복구 지점이다. 다음 변경이 깨지면 마지막 known-good state로 돌아갈 수 있어야 한다.

### 2. Atomic Commits

각 커밋은 하나의 논리적 일을 해야 한다.

좋은 예:

```text
feat: 태스크 생성 엔드포인트에 입력 검증 추가
feat: 태스크 생성 폼 컴포넌트 추가
feat: 폼을 API에 연결하고 로딩 상태 반영
test: 태스크 생성 테스트 추가
```

나쁜 예:

```text
태스크 기능 추가, 사이드바 수정, 의존성 업데이트, 유틸 리팩터링
```

### 3. Descriptive Messages

커밋 메시지는 `what`만이 아니라 `why`를 설명해야 한다.

형식:

```text
<type>: <한국어 요약>
```

type 예시:

- `feat`
- `fix`
- `refactor`
- `test`
- `docs`
- `chore`

좋은 예:

```text
fix: 회원가입 경계에서 이메일 형식 검증 추가

잘못된 이메일 문자열이 데이터베이스까지 도달하는 것을 막는다.
기존 auth route의 Zod 검증 패턴과 일치시킨다.
```

나쁜 예:

```text
auth.ts 수정
이것저것 수정
잡다한 변경
```

### 4. Keep Concerns Separate

formatting change와 behavior change를 섞지 않는다. refactor와 feature도 섞지 않는다.

좋은 예:

```bash
git commit -m "refactor: 검증 로직을 공용 유틸로 추출"
git commit -m "feat: 회원가입에 전화번호 검증 추가"
```

나쁜 예:

```bash
git commit -m "검증 리팩터링하고 전화번호 필드도 추가"
```

작은 rename 정도는 리뷰어 판단에 따라 feature commit에 포함될 수 있지만, 기본 원칙은 분리다.

### 5. Size Your Changes

대략적인 기준:

```text
~100 lines  → review/revert 쉬움
~300 lines  → 하나의 논리적 변경이면 허용 가능
~1000 lines → 나눠야 함
```

큰 변경 분해 전략은 `code-review-and-quality`의 splitting guidance를 따른다.

## Branching Strategy

### Feature Branches

```text
main
├── feature/task-creation
├── feature/user-settings
└── fix/duplicate-tasks
```

규칙:

- `main` 또는 팀 기본 브랜치에서 분기
- 1~3일 안에 머지되는 짧은 생명주기 유지
- 머지 후 branch 삭제
- 미완성 기능은 long-lived branch보다 feature flag 선호

### Branch Naming

```text
feature/task-creation
fix/duplicate-tasks
chore/update-deps
refactor/auth-module
```

## Working With Worktrees

병렬 에이전트 작업에는 worktree가 유용하다.

```bash
git worktree add ../project-feature-a feature/task-creation
git worktree add ../project-feature-b feature/user-settings
```

장점:

- 여러 브랜치를 동시에 다른 디렉터리에서 다룰 수 있음
- branch switching 불필요
- 한 실험이 실패해도 다른 작업을 오염시키지 않음

정리:

```bash
git worktree remove ../project-feature-a
```

## The Save Point Pattern

```text
Agent starts work
│
├── 변경
├── 테스트 통과? → Commit → Continue
└── 테스트 실패? → 마지막 안전 상태로 비파괴적으로 복귀 후 조사
│
└── 기능 완료 → 깔끔한 history 형성
```

여기서 핵심은 **작은 커밋으로 안전 지점을 자주 만드는 것**이다. 이 저장소 운영 규칙상 `git reset --hard` 같은 파괴적 복구는 기본값으로 쓰지 않는다. 기본 복구는 아래 순서로 생각한다.

- 아직 커밋 전이면 변경 범위를 확인하고 필요한 파일만 `git restore --source=HEAD -- <path>`로 되돌릴지 검토
- 이미 커밋된 잘못된 변경이면 `git revert <commit>` 검토
- 문제 원인을 분리하려면 새 incremental commit으로 수정

파괴적 명령은 별도 승인 없이는 기본 흐름에 넣지 않는다.

## Change Summaries

변경 후에는 구조화된 요약을 남긴다.

```text
변경한 내용:
- src/routes/tasks.ts: POST validation middleware 추가
- src/lib/validation.ts: TaskCreateSchema 추가

건드리지 않은 것:
- src/routes/auth.ts: 비슷한 gap 있지만 범위 밖
- src/middleware/error.ts: 별도 task가 필요한 개선점

잠재 우려:
- Zod schema가 extra field를 거부함
- 새 dependency 추가 여부와 크기 영향
```

`건드리지 않은 것` 섹션은 특히 중요하다. 범위 절제를 실제로 했다는 증거가 된다.

## Pre-Commit Hygiene

커밋 전에는 최소한 다음을 본다.

```bash
# 1. staged diff 확인
git diff --staged

# 2. secret 점검
git diff --staged | grep -i "password\\|secret\\|api_key\\|token"

# 3. tests
npm test

# 4. lint
npm run lint

# 5. type check
npx tsc --noEmit
```

가능하면 hook으로 자동화한다.

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

## Handling Generated Files

- 프로젝트가 기대하는 generated file만 커밋한다.
  - 예: `package-lock.json`, migration file
- 아래는 커밋하지 않는다.
  - build output (`dist/`, `.next/`)
  - env file (`.env`)
  - 개인용 IDE 설정

`.gitignore`에는 최소한 아래가 있어야 한다.

```text
node_modules/
dist/
.env
.env.local
*.pem
```

## Using Git For Debugging

```bash
# 최근 변경 보기
git log --oneline -20

# 특정 경로 diff 보기
git diff HEAD~5..HEAD -- src/

# 특정 라인 변경자 보기
git blame src/services/task.ts
```

회귀 버그라면 `git bisect`도 사용한다.

```bash
git bisect start
git bisect bad HEAD
git bisect good <known-good-commit>
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "기능 끝나면 한 번에 커밋하자" | 거대한 커밋은 리뷰, 디버깅, 롤백이 모두 어렵다. |
| "메시지는 중요하지 않다" | 메시지는 미래의 문서다. 미래의 사람과 에이전트가 읽는다. |
| "나중에 squash하면 된다" | 나쁜 히스토리를 나중에 정리하는 것보다 처음부터 작은 커밋이 낫다. |
| "브랜치는 오버헤드다" | 짧은 브랜치는 거의 공짜다. 오래 사는 브랜치가 문제다. |
| "큰 변경은 나중에 나누면 된다" | 제출 전 나누는 편이 리뷰와 배포 모두 훨씬 쉽다. |
| ".gitignore는 나중에 해도 된다" | 그 사이 `.env`가 커밋되면 이미 늦다. |

## Red Flags

- 커밋되지 않은 큰 변경이 계속 쌓이는 상태
- `fix`, `update`, `misc` 같은 메시지
- formatting과 behavior change가 섞인 커밋
- `.gitignore`가 없거나 빈약한 상태
- `node_modules`, `.env`, build artifact 커밋
- `main`과 크게 벌어진 장수 브랜치
- 공유 브랜치에 대한 force push

## Verification

각 커밋 전에 다음을 확인한다.

- [ ] 커밋이 하나의 논리적 일만 한다.
- [ ] 메시지가 왜 바뀌었는지 설명하고 type convention을 따른다.
- [ ] 커밋 전 테스트가 통과한다.
- [ ] diff에 secret이 없다.
- [ ] formatting-only change와 behavior change가 섞이지 않았다.
- [ ] `.gitignore`가 기본 제외 항목을 덮고 있다.
