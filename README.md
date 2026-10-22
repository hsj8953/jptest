# 카키토리 노트 (書き取りノート)

J-POP을 유튜브로 한 문장씩 듣고 일본어로 받아쓰는 공부 사이트예요.

## 실행

```bash
npm install     # 후리가나 사전(약 18MB)이 public/kuromoji 로 자동 복사돼요
npm run dev     # http://localhost:3000
```

## Firebase 설정

1. Firebase 콘솔에서 **Authentication → Google** 로그인을 켜고, **Firestore** 데이터베이스(서울, 프로덕션 모드)를 만들어요.
2. **설정 → 프로젝트 설정 → 내 앱**에서 웹 앱을 등록하고 `firebaseConfig` 값을 확인해요.
3. `.env.example` 을 복사해 `.env.local` 로 이름을 바꾸고 값과 관리자 이메일을 채워요. (`.env.local` 은 GitHub에 안 올라가요)
4. `firestore.rules` 의 `ADMIN_EMAIL_HERE` 를 관리자 이메일로 바꾼 뒤, 콘솔의 **Firestore → 규칙** 탭에 통째로 붙여넣고 **게시**해요.
5. `npm run dev` 로 실행해서 관리자 이메일로 로그인해요.

## 누가 무엇을 할 수 있나

- **관리자** (`NEXT_PUBLIC_ADMIN_EMAIL`): 곡 등록 · 편집 · 타이밍 · 삭제, 친구 초대
- **초대된 친구** (친구 초대 화면에 추가한 이메일): 곡 목록, 받아쓰기, 결과 보기
- **그 외**: "아직 초대되지 않은 계정이에요" 화면만 보여요
- 화면의 버튼 구분과 별개로, 실제 권한은 `firestore.rules` 가 서버에서 막아요.

## 배포 (Vercel)

1. vercel.com 에서 GitHub 저장소를 가져와요(Import).
2. **Environment Variables** 에 `.env.local` 과 같은 값 5개를 넣고 배포해요.
3. Firebase 콘솔 **Authentication → 설정 → 승인된 도메인**에 Vercel 주소(예: `jptest.vercel.app`)를 추가해요.

## 폴더 구조

```
app/page.tsx                  화면 전환, 다크 모드
components/kakitori/
  library.tsx                 노래 목록
  study.tsx                   받아쓰기 · 채점 · 틀린 글자 비교
  editor.tsx                  곡 등록/편집 · 한자 읽기 자동 생성
  timing.tsx                  타이밍 찍기 (스페이스바 지원)
  invite.tsx                  친구 초대
  header.tsx / login.tsx      헤더, 로그인
lib/
  firebase.ts                 Firebase 연결
  store.ts                    Firestore 읽기/쓰기 · 실시간 동기화
  youtube.ts                  유튜브 플레이어 · 구간 재생
  furigana.ts                 한자 읽기 자동 생성 (kuromoji)
  ruby.ts                     漢字{かんじ} 표기 처리
  diff.ts                     글자 단위 비교
scripts/copy-kuromoji.mjs     사전 복사 스크립트
```

## 후리가나 표기

`夜空{よぞら}に光{ひかり}が` 처럼 한자 바로 뒤에 중괄호로 읽기를 적어요. 채점할 때는 중괄호 부분을 빼고 비교해요.
