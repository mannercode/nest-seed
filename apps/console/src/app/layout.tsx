import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
    title: 'Nest-Seed Console',
    description: 'Nest-seed 백엔드용 데모 콘솔'
}

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    )
}
