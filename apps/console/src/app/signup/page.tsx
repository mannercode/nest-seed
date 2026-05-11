'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ApiError, api } from '@/lib/api-client'

export default function SignupPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const [birthDate, setBirthDate] = useState('1990-01-01')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setBusy(true)
        try {
            await api.post('/users', {
                body: { email, name, password, birthDate: new Date(birthDate).toISOString() }
            })
            router.push('/login')
        } catch (err) {
            const message = err instanceof ApiError ? err.message : '가입 실패'
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
                <h1 className="text-xl font-semibold">가입</h1>
                <Field label="이메일">
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputCls}
                    />
                </Field>
                <Field label="이름">
                    <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputCls}
                    />
                </Field>
                <Field label="비밀번호">
                    <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputCls}
                    />
                </Field>
                <Field label="생년월일">
                    <input
                        type="date"
                        required
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className={inputCls}
                    />
                </Field>
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
                    {busy ? '가입 중…' : '가입하기'}
                </button>
                <p className="text-sm text-slate-500">
                    이미 계정이 있다면{' '}
                    <Link href="/login" className="underline">
                        로그인
                    </Link>
                </p>
            </form>
        </main>
    )
}

const inputCls =
    'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block text-sm font-medium text-slate-700">
            {label}
            {children}
        </label>
    )
}
