# ScopeNote (스코프노트)

> **1인 웹디자이너를 위한 합의 변경 및 추가 요청 관리 웹 서비스**  
> 고객의 추가 요청을 최초 기준 합의와 대조·분류하고, 변경 범위·금액·납기를 제안하여 고객의 결정을 안전하게 기록합니다.

---

## 1. 프로젝트 특징

- **Next.js App Router + TypeScript + Tailwind CSS**
- **정밀한 합의 범위 계산 엔진**: 산출물별 고유 ID(`add`, `update`, `remove`) 기반으로 승인된 변경 내역을 순차 누적하여 현재 합의 범위와 누적 금액 및 납기 계산
- **상태 머신 및 버전 관리**: 프로젝트당 `pending` 버전은 최대 1개만 허용 (PostgreSQL partial unique index + 앱 검증)
- **동시성 & 원자적 트랜잭션**: 승인과 철회 시 일관된 잠금 순서 적용, 중복 승인 및 멱등성 키(`idempotency_key`) 지원
- **32바이트 암호학적 토큰 & 해시 저장**: 데이터베이스에는 SHA-256 토큰 해시만 저장, 익명 테이블 조회 권한 차단
- **서버 전용 AI 어댑터 & UTF-16 슬라이스 검증기**: `sourceText.slice(start, end) === quote` 일치 검증을 통과한 유효 근거만 채택 (불일치 시 `needs_clarification`으로 안전하게 격하)
- **360px 모바일 완벽 대응 무가입 고객 페이지**: 가로 스크롤 없는 반응형 레이아웃 및 웹 접근성 레이블 지원
- **외부 키 없이도 100% 로컬 검증 가능**: 데모 시드 데이터와 수동 검토·제안·승인 폴백 파이프라인 내장

---

## 2. 빠른 시작 (로컬 실행)

### 필수 요구사항
- Node.js 20.x 이상
- npm 10.x 이상

### 설치 및 개발 서버 실행
```bash
# 의존성 설치
npm install

# 개발 서버 실행 (기본 포트: 3000)
npm run dev
```

브라우저에서 `http://localhost:3000` 에 접속하면 프로젝트 대시보드로 이동합니다.

---

## 3. 핵심 페이지 구성

| 경로 | 역할 및 주요 기능 |
|---|---|
| `/auth` | 이메일 로그인 및 로컬 개발 환경 세션 시작 안내 |
| `/projects` | 프로젝트 목록, 응답 대기 제안수, 최근 결정 내역, 새 프로젝트 생성 |
| `/projects/new` | 프로젝트명, 고객명, 통화, 세금 포함 여부, 합의문 입력 및 산출물 추출 |
| `/projects/[projectId]` | 현재 합의 범위, 최초 기준 범위, 새 고객 요청 입력, 변경 제안 목록, 삭제 |
| `/projects/[projectId]/requests/[requestId]` | 고객 메시지 원문, 항목별 AI/규칙 분류 및 근거 확인, 검토 완료 및 제안서 작성 |
| `/projects/[projectId]/proposals/[proposalId]` | 버전별 내용, 공유 링크 발급, 링크 복사, 제안 철회, 새 버전 작성 |
| `/s/[token]` | 360px 모바일 완벽 지원 무가입 고객 페이지 (달라진 점, 금액, 납기, 확인 체크박스, 승인 및 수정 요청) |

---

## 4. 테스트 실행

### 도메인 로직 및 핵심 명세 검증 (Vitest)
```bash
npx vitest run --config vitest.config.mjs
```
실행되는 테스트 항목:
- `A. 명확한 추가 작업`: 5개 페이지 합의문 대조 시 "가격 비교 페이지 추가" -> `additional_candidate` 분류, 원문 슬라이스 근거 일치, 금액/납기 자동생성 없음
- `B. 판단 기준 부족`: "디자인 수정 포함"만 기재 시 "모바일 레이아웃 구조 변경" -> `needs_clarification`
- `C. 구버전 링크 방어`: 새 버전 생성 및 이전 링크 철회 시 이전 링크 승인 차단 및 안내 표시
- `D. 중복 승인 및 멱등성`: 동시 승인 및 네트워크 재시도 시 결정 1개, `scope_changes` 1개만 생성되고 기존 결과 반환
- `E. 승인·철회 경쟁`: 동시 호출 시 유효한 단 1개의 상태 전이만 성공
- `범위 누적 엔진`: add, update, remove 액션에 따른 Deliverables 변화, 금액 누적, 납기 갱신 검증
- `E2E 전체 흐름`: 프로젝트 생성부터 요청 검토, 제안서 공유, 고객 승인, 리비전 갱신까지 원스톱 검증

### AI 모델 품질 및 실제 사례 평가 스크립트
```bash
# 평가 데이터셋: evaluation/eval-ai-dataset.json
node -e "import('./src/lib/ai/adapter.ts')" # 스텁과 실제 모델 분리 평가
```

---

## 5. 데이터베이스 마이그레이션 및 Supabase 설정

운영 환경 또는 Supabase 클라우드에 연결할 때 적용할 마이그레이션 파일:
- 경로: `supabase/migrations/0001_initial_schema.sql`

포함된 제약 조건 및 인덱스:
- 프로젝트당 단 하나의 pending 버전만 허용하는 Partial Unique Index:
  ```sql
  CREATE UNIQUE INDEX unique_pending_proposal_per_project 
  ON proposal_versions (project_id) 
  WHERE (status = 'pending');
  ```
- 외래키 및 제약 조건 (`proposal_version_id` UNIQUE 제약 등)
- Row Level Security (RLS) 정책 (소유자 기준 격리 및 하위 테이블 일관 보호)
- 토큰 해시 전용 인덱스

---

## 6. 환경 변수 설정 (`.env.example`)

운영 키가 필요한 경우 `.env.local` 파일을 생성하여 설정합니다:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI API Key (미설정 시 내장된 지능형 규칙 검증기로 자동 폴백)
OPENAI_API_KEY=sk-...

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 7. 배포 및 인프라 운영 체크리스트

1. **배포 전 인프라 검증**:
   - Supabase RLS 정책 활성화 및 서비스 롤 키 보호
   - PostgreSQL partial unique index 정상 생성 확인
   - `NEXT_PUBLIC_APP_URL`에 HTTPS 도메인 지정
2. **보안 및 개인정보 보호**:
   - 고객 공유 페이지에 `no-store, noindex, Referrer-Policy: no-referrer` 헤더 적용 완료
   - 로그 및 분석 이벤트(`analytics_events`)에 토큰, 고객 원문, 고객 이름 미포함 정책 준수
3. **데이터 수명 주기 관리**:
   - 프로젝트 삭제 시 즉시 soft-delete 및 관련 공유 링크 일괄 만료(`revoked_at`)
   - 30일 경과된 삭제 데이터 정리 배치 쿼리 실행
   - 인프라 차원의 백업 보관 주기(90일 이내) 점검
