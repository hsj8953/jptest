'use client'

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore'

// .env.local 의 값을 읽어요. (NEXT_PUBLIC_ 값은 빌드할 때 코드에 들어가요)
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const firebaseConfigured = !!(config.apiKey && config.authDomain && config.projectId && config.appId)

/** 관리자 구글 이메일. 화면에서 관리자 버튼을 보여줄지 정할 때만 써요. 실제 권한은 firestore.rules 가 지켜요. */
export const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim().toLowerCase()

let app: FirebaseApp | null = null
let db: Firestore | null = null

function getFirebaseApp() {
  if (!app) app = getApps()[0] ?? initializeApp(config)
  return app
}

export const getFirebaseAuth = () => getAuth(getFirebaseApp())

export function getDb() {
  if (!db) {
    try {
      db = initializeFirestore(getFirebaseApp(), { ignoreUndefinedProperties: true })
    } catch {
      db = getFirestore(getFirebaseApp())
    }
  }
  return db
}

export function googleProvider() {
  const p = new GoogleAuthProvider()
  p.setCustomParameters({ prompt: 'select_account' })
  return p
}
