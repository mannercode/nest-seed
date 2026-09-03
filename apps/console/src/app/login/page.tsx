'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ApiError, api } from '@/lib/api-client'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setBusy(true)
        try {
            await api.post('/admins/login', { body: { email, password } })
            router.push('/movies/new')
        } catch (err) {
            const message = err instanceof ApiError ? err.message : '로그인 실패'
            setError(message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center px-6 py-12">
            <form
                onSubmit={onSubmit}
                className="w-full max-w-md space-y-5 rounded-xl bg-white p-8 shadow"
            >
                <h1 className="text-xl font-semibold">관리자 로그인</h1>
                <p className="text-sm text-slate-500">
                    콘솔은 운영자(admin) 전용이다. 개발용 admin은 인프라 초기화 때 준비되며 실제
                    프로젝트의 최초 admin은 운영 명령으로 만든다.
                </p>
                <label className="block text-sm font-medium text-slate-700">
                    이메일
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputCls}
                    />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                    비밀번호
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputCls}
                    />
                </label>
                {error && (
                    <p role="alert" className="text-sm text-red-600">
                        {error}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                    {busy ? '로그인 중…' : '로그인'}
                </button>
            </form>
        </main>
    )
}

const inputCls =
    'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none'
