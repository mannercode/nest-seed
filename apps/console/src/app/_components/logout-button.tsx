'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/api-client'

export function LogoutButton() {
    const router = useRouter()
    const [busy, setBusy] = useState(false)

    async function logout() {
        setBusy(true)
        try {
            await api.post('/admins/logout', { body: {} })
        } catch {
            // BFF는 upstream 실패 때도 로컬 쿠키를 지운다. 로그인 화면으로 이동해 재인증한다.
        } finally {
            router.replace('/login')
            router.refresh()
            setBusy(false)
        }
    }

    return (
        <button
            type="button"
            onClick={() => void logout()}
            disabled={busy}
            className="text-sm font-medium text-slate-700 underline disabled:opacity-50"
        >
            {busy ? '로그아웃 중…' : '로그아웃'}
        </button>
    )
}
