import type { Song } from './types'

// 처음 들어왔을 때 보이는 예시 곡 (지어낸 문장, 유튜브 링크 없음)
export const seedSongs: Song[] = [
  {
    id: 'sample-1',
    title: '星降る帰り道',
    artist: '예시 곡',
    youtubeId: null,
    createdAt: 3,
    lines: [
      { ruby: '夜空{よぞら}に小{ちい}さな光{ひかり}が咲{さ}いた', ko: '밤하늘에 작은 빛이 피어났어', start: 0 },
      { ruby: '君{きみ}と歩{ある}く帰{かえ}り道{みち}は特別{とくべつ}だね', ko: '너와 걷는 귀갓길은 특별하네', start: 8.4 },
      { ruby: '遠{とお}くで電車{でんしゃ}の音{おと}が聞{き}こえる', ko: '멀리서 전철 소리가 들려와', start: 16.8 },
      { ruby: '明日{あした}も同{おな}じ笑顔{えがお}で会{あ}おう', ko: '내일도 같은 웃음으로 만나자', start: 25.1 },
    ],
  },
  {
    id: 'sample-2',
    title: '雨上がりのメロディ',
    artist: '예시 곡',
    youtubeId: null,
    createdAt: 2,
    lines: [
      { ruby: '雨上{あめあ}がりの街{まち}は少{すこ}し透明{とうめい}', ko: '비가 갠 거리는 조금 투명해', start: 0 },
      { ruby: '濡{ぬ}れた靴{くつ}でリズムを刻{きざ}む', ko: '젖은 신발로 리듬을 새겨', start: 7.2 },
      { ruby: '虹{にじ}の向{む}こうへ行{い}ってみよう', ko: '무지개 너머로 가 보자', start: 14.9 },
    ],
  },
  {
    id: 'sample-3',
    title: 'まだ見ぬ朝',
    artist: '예시 곡',
    youtubeId: null,
    createdAt: 1,
    lines: [{ ruby: 'まだ見{み}ぬ朝{あさ}を迎{むか}えに行{い}こう', ko: '아직 보지 못한 아침을 맞으러 가자', start: null }],
  },
]
