import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
    title: 'Nest-Seed',
    description: '사용자 앱 데모 — 사용자 앱이 view 레이어를 어떻게 소비하는지 보인다'
}

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    )
}
