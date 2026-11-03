import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
    title: 'Nest-Seed',
    description: '회원가입·로그인과 영화 추천을 확인할 수 있는 사용자 앱 데모'
}

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    )
}
