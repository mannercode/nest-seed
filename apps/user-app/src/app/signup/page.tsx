'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ApiError, postJson } from '@/lib/api-client'

export default function SignupPage() {
    const router = useRouter()
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [birthDate, setBirthDate] = useState('2000-01-01')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setBusy(true)
        try {
            await postJson('/users', {
                name,
                email,
                password,
                birthDate: new Date(birthDate).toISOString()
            })
            router.push('/login')
        } catch (err) {
            setError(err instanceof ApiError ? err.message : '회원가입 실패')
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
                <h1 className="text-xl font-semibold">회원가입</h1>
                <label className="block text-sm font-medium text-slate-700">
                    이름
                    <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputCls}
                    />
                </label>
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
                <label className="block text-sm font-medium text-slate-700">
                    생년월일
                    <input
                        type="date"
                        required
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
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
                    {busy ? '가입 중…' : '회원가입'}
                </button>
                <p className="text-center text-sm text-slate-500">
                    이미 계정이 있으면{' '}
                    <Link href="/login" className="font-medium text-slate-900 underline">
                        로그인
                    </Link>
                </p>
            </form>
        </main>
    )
}

const inputCls =
    'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none'
