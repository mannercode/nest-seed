'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/api-client'

export function LogoutButton() {
    const router = useRouter()
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function logout() {
        setBusy(true)
        setError(null)
        try {
            await api.post('/admins/logout', { body: {} })
            router.replace('/login')
            router.refresh()
        } catch {
            setError('로그아웃 요청을 완료하지 못했습니다. 다시 시도해 주세요.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="text-right">
            <button
                type="button"
                onClick={() => void logout()}
                disabled={busy}
                className="text-sm font-medium text-slate-700 underline disabled:opacity-50"
            >
                {busy ? '로그아웃 중…' : '로그아웃'}
            </button>
            {error && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                    {error}
                </p>
            )}
        </div>
    )
}
