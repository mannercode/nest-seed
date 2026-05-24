'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ApiError, api } from '@/lib/api-client'
import { clearSession, readToken } from '@/lib/session'

const GENRES = [
    'action',
    'comedy',
    'drama',
    'fantasy',
    'horror',
    'mystery',
    'romance',
    'thriller',
    'western'
] as const
const RATINGS = ['G', 'PG', 'PG13', 'R', 'NC17'] as const

export default function NewMoviePage() {
    const router = useRouter()
    const [ready, setReady] = useState(false)
    const [title, setTitle] = useState('')
    const [director, setDirector] = useState('')
    const [plot, setPlot] = useState('')
    const [genre, setGenre] = useState<(typeof GENRES)[number]>('drama')
    const [rating, setRating] = useState<(typeof RATINGS)[number]>('PG')
    const [releaseDate, setReleaseDate] = useState('2024-01-01')
    const [runtimeMinutes, setRuntimeMinutes] = useState('120')
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
            // 영화 목록 API는 공개된 영화만 반환한다.
            // 등록 직후에 목록에 바로 보이도록, 생성한 뒤 공개 처리까지 같이 호출한다.
            const created = await api.post<{ id: string }>('/movies', {
                accessToken: readToken() ?? undefined,
                body: {
                    title,
                    director,
                    plot,
                    genres: [genre],
                    rating,
                    releaseDate: new Date(releaseDate).toISOString(),
                    durationInSeconds: Math.max(1, Number(runtimeMinutes)) * 60
                }
            })
            await api.post(`/movies/${created.id}/publish`, {
                accessToken: readToken() ?? undefined
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
            <h1 className="mb-6 text-2xl font-semibold">새 영화 등록</h1>
            <form
                onSubmit={onSubmit}
                className="space-y-5 rounded-xl bg-white p-6 shadow ring-1 ring-slate-200"
            >
                <Field label="제목">
                    <input
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={inputCls}
                    />
                </Field>
                <Field label="감독">
                    <input
                        value={director}
                        onChange={(e) => setDirector(e.target.value)}
                        className={inputCls}
                    />
                </Field>
                <Field label="줄거리">
                    <textarea
                        value={plot}
                        onChange={(e) => setPlot(e.target.value)}
                        rows={4}
                        className={inputCls}
                    />
                </Field>
                <Field label="장르">
                    <select
                        value={genre}
                        onChange={(e) => setGenre(e.target.value as (typeof GENRES)[number])}
                        className={inputCls}
                    >
                        {GENRES.map((g) => (
                            <option key={g} value={g}>
                                {g}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="등급">
                    <select
                        value={rating}
                        onChange={(e) => setRating(e.target.value as (typeof RATINGS)[number])}
                        className={inputCls}
                    >
                        {RATINGS.map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="개봉일">
                    <input
                        type="date"
                        required
                        value={releaseDate}
                        onChange={(e) => setReleaseDate(e.target.value)}
                        className={inputCls}
                    />
                </Field>
                <Field label="상영시간 (분)">
                    <input
                        type="number"
                        required
                        min={1}
                        value={runtimeMinutes}
                        onChange={(e) => setRuntimeMinutes(e.target.value)}
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
