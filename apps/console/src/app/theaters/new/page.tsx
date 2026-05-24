'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ApiError, api } from '@/lib/api-client'
import { clearSession, readToken } from '@/lib/session'

// seatmap은 실제 운영에선 평면도 편집기로 입력하지만 시드 콘솔에서는 한 블록·한 행·N개 좌석으로 단순화해서 등록 흐름만 보여준다.
function buildDefaultSeatmap(seatCount: number) {
    return {
        blocks: [{ name: 'A', rows: [{ name: '1', layout: 'O'.repeat(Math.max(1, seatCount)) }] }]
    }
}

export default function NewTheaterPage() {
    const router = useRouter()
    const [ready, setReady] = useState(false)
    const [name, setName] = useState('')
    const [latitude, setLatitude] = useState('37.5665')
    const [longitude, setLongitude] = useState('126.978')
    const [seatCount, setSeatCount] = useState('20')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!readToken()) {
            router.replace('/login')
            return
        }
        setReady(true)
    }, [router])

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setBusy(true)
        try {
            await api.post('/theaters', {
                accessToken: readToken() ?? undefined,
                body: {
                    name,
                    location: { latitude: Number(latitude), longitude: Number(longitude) },
                    seatmap: buildDefaultSeatmap(Number(seatCount))
                }
            })
            router.push('/')
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                clearSession()
                router.replace('/login')
                return
            }
            setError(err instanceof Error ? err.message : '등록 실패')
        } finally {
            setBusy(false)
        }
    }

    if (!ready) return null

    return (
        <main className="mx-auto max-w-xl px-6 py-10">
            <h1 className="mb-6 text-2xl font-semibold">새 극장 등록</h1>
            <form
                onSubmit={onSubmit}
                className="space-y-5 rounded-xl bg-white p-6 shadow ring-1 ring-slate-200"
            >
                <Field label="이름">
                    <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputCls}
                    />
                </Field>
                <Field label="위도">
                    <input
                        type="number"
                        step="any"
                        required
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        className={inputCls}
                    />
                </Field>
                <Field label="경도">
                    <input
                        type="number"
                        step="any"
                        required
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        className={inputCls}
                    />
                </Field>
                <Field label="좌석 수 (1행)">
                    <input
                        type="number"
                        required
                        min={1}
                        value={seatCount}
                        onChange={(e) => setSeatCount(e.target.value)}
                        className={inputCls}
                    />
                </Field>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => router.push('/')}
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        disabled={busy}
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                        {busy ? '저장 중…' : '저장'}
                    </button>
                </div>
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
