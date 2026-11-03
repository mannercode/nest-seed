import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
    title: 'Nest-Seed',
    description: '사진을 첨부한 회원가입·로그인과 내 정보 조회 예제'
}

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    )
}
