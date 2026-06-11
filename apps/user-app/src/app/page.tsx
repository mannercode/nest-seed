'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ApiError, getJson } from '@/lib/api-client'
import { clearSession, readEmail } from '@/lib/session'

type ShowtimeView = {
    id: string
    startTime: string
    endTime: string
    theater: { id: string; name: string }
}
type Movie = { id: string; title: string; director: string; rating: string; releaseDate: string }
type MovieCard = { movie: Movie; upcomingShowtimes: ShowtimeView[] }
type HomeView = { showingMovies: MovieCard[]; recommendedMovies: Movie[] }

export default function HomePage() {
    const [home, setHome] = useState<HomeView | null>(null)
    const [error, setError] = useState<string | null>(null)
    // 로그인 상태는 브라우저에서만 알 수 있으므로 마운트 후에 읽어 하이드레이션 불일치를 피한다.
    const [email, setEmail] = useState<string | null>(null)

    useEffect(() => {
        setEmail(readEmail())
    }, [])

    function onLogout() {
        clearSession()
        setEmail(null)
    }

    useEffect(() => {
        getJson<HomeView>('/views/user-app/home')
            .then(setHome)
            .catch((err) => {
                const message =
                    err instanceof ApiError
                        ? err.message
                        : err instanceof Error
                          ? err.message
                          : '홈 화면을 불러올 수 없다'
                setError(message)
            })
    }, [])

    if (error) {
        return <main className="mx-auto max-w-4xl px-6 py-10 text-sm text-red-600">{error}</main>
    }
    if (home === null) {
        return (
            <main className="mx-auto max-w-4xl px-6 py-10 text-sm text-slate-500">
                불러오는 중…
            </main>
        )
    }

    return (
        <main className="mx-auto max-w-4xl px-6 py-10">
            <header className="mb-8 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold">지금 볼 만한 영화</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        개봉된 영화 중 다가오는 상영을 빠르게 확인한다
                    </p>
                </div>
                <nav className="flex shrink-0 items-center gap-3 text-sm">
                    {email ? (
                        <>
                            <span className="text-slate-500">{email}</span>
                            <button
                                type="button"
                                onClick={onLogout}
                                className="font-medium text-slate-900 underline"
                            >
                                로그아웃
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="font-medium text-slate-900 underline">
                                로그인
                            </Link>
                            <Link href="/signup" className="font-medium text-slate-900 underline">
                                회원가입
                            </Link>
                        </>
                    )}
                </nav>
            </header>
            {home.recommendedMovies.length > 0 && (
                <section className="mb-8" data-testid="recommended-movies">
                    {/* 이 데모는 게스트 읽기 전용이라 토큰을 보내지 않는다.
                        추천은 항상 비개인화(개봉일 순)이므로 개인화를 약속하는 문구를 쓰지 않는다. */}
                    <h2 className="text-lg font-medium">추천 영화</h2>
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {home.recommendedMovies.map((movie) => (
                            <li
                                key={movie.id}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm"
                            >
                                {movie.title}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {home.showingMovies.length === 0 ? (
                <p className="text-sm text-slate-500">아직 상영 예정인 영화가 없다</p>
            ) : (
                <ul className="grid gap-4 sm:grid-cols-2" data-testid="movie-cards">
                    {home.showingMovies.map(({ movie, upcomingShowtimes }) => (
                        <li
                            key={movie.id}
                            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                            <h2 className="text-lg font-medium">{movie.title}</h2>
                            <p className="mt-1 text-xs text-slate-500">
                                {movie.director} · {movie.rating}
                            </p>
                            <section className="mt-4 border-t border-slate-200 pt-3">
                                <h3 className="text-sm font-medium text-slate-900">상영시간</h3>
                                <ul className="mt-2 grid gap-2">
                                    {upcomingShowtimes.map((showtime) => (
                                        <li
                                            key={showtime.id}
                                            className="rounded-md border border-slate-200 px-3 py-2"
                                        >
                                            <p className="text-sm font-medium">
                                                {formatDateTime(showtime.startTime)}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {showtime.theater.name}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    )
}

function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(value))
}
