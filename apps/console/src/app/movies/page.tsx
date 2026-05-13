'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ApiError, api } from '@/lib/api-client'
import { clearSession, readEmail, readToken } from '@/lib/session'

type Movie = {
    id: string
    title: string
    director: string
    plot: string
    genres: string[]
    rating: string
    releaseDate: string
}

type MoviesPage = { items: Movie[]; page: number; size: number; total: number }

export default function MoviesPage() {
    const router = useRouter()
    const [movies, setMovies] = useState<Movie[] | null>(null)
    const [email, setEmail] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const token = readToken()
        if (!token) {
            router.replace('/login')
            return
        }
        setEmail(readEmail())

        api.get<MoviesPage>('/movies?size=50&orderby=createdAt:desc')
            .then((page) => setMovies(page.items))
            .catch((err) => {
                if (err instanceof ApiError && err.status === 401) {
                    clearSession()
                    router.replace('/login')
                    return
                }
                setError(err instanceof Error ? err.message : '영화 목록 조회 실패')
            })
    }, [router])

    function onLogout() {
        clearSession()
        router.replace('/login')
    }

    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <header className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-semibold">영화 목록</h1>
                <div className="flex items-center gap-3 text-sm">
                    {email && <span className="text-slate-500">{email}</span>}
                    <Link
                        href="/movies/new"
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700"
                    >
                        새 영화 등록
                    </Link>
                    <button
                        onClick={onLogout}
                        className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
                    >
                        로그아웃
                    </button>
                </div>
            </header>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            {movies === null && !error && <p className="text-sm text-slate-500">불러오는 중…</p>}
            {movies && movies.length === 0 && (
                <p className="text-sm text-slate-500">등록된 영화 없음</p>
            )}
            {movies && movies.length > 0 && (
                <ul data-testid="movie-list" className="space-y-3">
                    {movies.map((m) => (
                        <li
                            key={m.id}
                            className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200"
                        >
                            <h2 className="text-lg font-medium">{m.title || '(제목 없음)'}</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {m.director || '감독 미정'} · {m.rating}
                            </p>
                            {m.plot && (
                                <p className="mt-2 line-clamp-3 text-sm text-slate-700">{m.plot}</p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </main>
    )
}
