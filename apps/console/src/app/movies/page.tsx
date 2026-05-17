'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ApiError, api } from '@/lib/api-client'
import { clearSession, readEmail, readToken } from '@/lib/session'

type Movie = {
    durationInSeconds: number
    genres: string[]
    id: string
    director: string
    imageUrls: string[]
    plot: string
    rating: string
    releaseDate: string
    title: string
}

type ConsoleShowtime = {
    endTime: string
    id: string
    movieId: string
    startTime: string
    theater: { id: string; name: string }
}

type ConsoleMovieItem = { movie: Movie; showtimes: ConsoleShowtime[] }

type ConsoleMoviesPage = { items: ConsoleMovieItem[]; page: number; size: number; total: number }

export default function MoviesPage() {
    const router = useRouter()
    const [items, setItems] = useState<ConsoleMovieItem[] | null>(null)
    const [email, setEmail] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const token = readToken()
        if (!token) {
            router.replace('/login')
            return
        }
        setEmail(readEmail())

        api.get<ConsoleMoviesPage>('/views/console/movies?size=50&orderby=createdAt:desc')
            .then((page) => setItems(page.items))
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
        <main className="mx-auto max-w-5xl px-6 py-10">
            <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">영화 목록</h1>
                    <p className="mt-1 text-sm text-slate-500">영화별 예정 상영시간</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
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

            {items === null && !error && <p className="text-sm text-slate-500">불러오는 중…</p>}
            {items && items.length === 0 && (
                <p className="text-sm text-slate-500">등록된 영화 없음</p>
            )}
            {items && items.length > 0 && (
                <ul data-testid="movie-list" className="space-y-4">
                    {items.map(({ movie, showtimes }) => (
                        <li
                            key={movie.id}
                            className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <h2 className="text-lg font-medium">
                                        {movie.title || '(제목 없음)'}
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {movie.director || '감독 미정'} · {movie.rating} ·{' '}
                                        {formatRuntime(movie.durationInSeconds)}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {movie.genres.join(', ') || '장르 미정'} ·{' '}
                                        {formatDate(movie.releaseDate)}
                                    </p>
                                    {movie.plot && (
                                        <p className="mt-3 line-clamp-2 text-sm text-slate-700">
                                            {movie.plot}
                                        </p>
                                    )}
                                </div>
                                <span className="inline-flex shrink-0 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                    상영 {showtimes.length}개
                                </span>
                            </div>

                            <section className="mt-4 border-t border-slate-200 pt-4">
                                <h3 className="text-sm font-medium text-slate-900">상영시간</h3>
                                {showtimes.length === 0 ? (
                                    <p className="mt-2 text-sm text-slate-500">
                                        예정된 상영시간 없음
                                    </p>
                                ) : (
                                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                                        {showtimes.map((showtime) => (
                                            <li
                                                key={showtime.id}
                                                className="rounded-md border border-slate-200 px-3 py-2"
                                            >
                                                <p className="text-sm font-medium text-slate-900">
                                                    {formatShowtimeDate(showtime.startTime)}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    {formatTimeRange(
                                                        showtime.startTime,
                                                        showtime.endTime
                                                    )}{' '}
                                                    · {showtime.theater.name}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    )
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat('ko-KR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(new Date(value))
}

function formatRuntime(seconds: number): string {
    const minutes = Math.max(1, Math.round(seconds / 60))
    return `${minutes}분`
}

function formatShowtimeDate(value: string): string {
    return new Intl.DateTimeFormat('ko-KR', {
        day: '2-digit',
        month: '2-digit',
        weekday: 'short'
    }).format(new Date(value))
}

function formatTimeRange(start: string, end: string): string {
    const formatter = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' })
    return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`
}
