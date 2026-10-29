// 서버(API)에서 관리자인지 확인해요. Firebase 로그인 토큰을 Google 공개키로 검증해요.
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { NextResponse } from 'next/server'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? ''
const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim().toLowerCase()
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

/** 관리자면 null, 아니면 돌려보낼 오류 응답 */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !PROJECT_ID) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID })
    const email = String(payload.email ?? '').toLowerCase()
    if (!payload.email_verified || !ADMIN_EMAIL || email !== ADMIN_EMAIL) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    return null
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}
