# 출석 관리 프론트엔드

Supabase에 출석 정보를 저장하는 간단한 React + Vite 애플리케이션입니다.

## 사전 준비

1. [Supabase](https://supabase.com)에서 새 프로젝트를 생성합니다.
2. `mmfc_check` 테이블을 아래 컬럼으로 생성합니다.
   - `id` : bigint, Primary Key, auto increment
   - `name` : text (사용자 이름)
   - `created_at` : timestamptz, default `now()`
3. `mmfc_admin_gate` 테이블을 생성합니다. (출석 시작/종료 상태 저장)
   - `id` : bigint, Primary Key
   - `is_active` : boolean, default `false`
   - `updated_at` : timestamptz, default `now()` (선택)
   - 초기 데이터로 `id = 1`, `is_active = false` 행을 하나 넣어둡니다.
4. 위 두 테이블에 대해 `anon` 키로 `select`, `insert`(`mmfc_check`), `upsert`(`mmfc_admin_gate`)가 가능하도록 RLS 정책을 추가합니다.
5. Supabase 프로젝트 설정 → `API` 탭에서 `Project URL`과 `anon public` 키를 확인합니다.
6. 프로젝트 루트에 `.env` 파일을 만들고 값을 입력합니다.
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-anon-key
   ```

## 개발

```bash
npm install
npm run dev
```

로컬 개발 서버는 기본적으로 `http://localhost:5173`에서 실행됩니다.

## 배포

1. `npm run build` 명령으로 정적 파일(`dist/`)을 생성합니다.
2. Netlify, Vercel, Cloudflare Pages 등 원하는 정적 호스팅 서비스에 업로드합니다.
3. 호스팅 서비스의 환경 변수 설정에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 값을 등록합니다.

배포 후 사용자는 이름을 입력하고 `출석 저장` 버튼을 눌러 Supabase 테이블에 출석 기록을 남길 수 있습니다.
