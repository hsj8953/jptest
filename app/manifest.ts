import type { MetadataRoute } from 'next'

/** 홈 화면에 앱으로 설치할 때 쓰는 정보 (PWA) */
export const APP_NAME = '카키토리'
export const APP_SHORT_NAME = '카키토리'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: '좋아하는 J-POP을 들으며 일본어 받아쓰기를 공부해요.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#2f3a56',
    theme_color: '#2f3a56',
    lang: 'ko',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
