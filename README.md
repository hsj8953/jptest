# 카키토리 노트 (書き取りノート)

J-POP을 유튜브로 한 문장씩 듣고 일본어로 받아쓰는 공부 사이트예요.

## 실행

```bash
npm install     # 후리가나 사전(약 18MB)이 public/kuromoji 로 자동 복사돼요
npm run dev     # http://localhost:3000
```

## 지금 상태

- 로그인은 아직 가짜예요. `lib/store.ts` 의 `MOCK_USER`(하루, 관리자)로 동작해요.
- 곡, 진도, 초대 목록은 **브라우저(localStorage)에만** 저장돼요. 다른 기기나 친구와는 아직 공유되지 않아요.
- Firebase를 붙일 때는 `lib/store.ts` 의 `actions` 와 `useStore` 안쪽만 Firestore로 바꾸면 화면 코드는 그대로 써요.
- 초대되지 않은 계정에게 보여줄 화면은 `components/kakitori/login.tsx` 의 `NotInvited` 에 만들어 뒀어요.

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
  store.ts                    임시 저장소 (Firebase로 바꿀 자리)
  youtube.ts                  유튜브 플레이어 · 구간 재생
  furigana.ts                 한자 읽기 자동 생성 (kuromoji)
  ruby.ts                     漢字{かんじ} 표기 처리
  diff.ts                     글자 단위 비교
scripts/copy-kuromoji.mjs     사전 복사 스크립트
```

## 후리가나 표기

`夜空{よぞら}に光{ひかり}が` 처럼 한자 바로 뒤에 중괄호로 읽기를 적어요. 채점할 때는 중괄호 부분을 빼고 비교해요.
