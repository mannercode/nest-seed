'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ApiError, api } from '@/lib/api-client'
import { clearSession, readToken } from '@/lib/session'

type Theater = { id: string; name: string; location: { latitude: number; longitude: number } }
type TheatersPage = { items: Theater[]; page: number; size: number; total: number }

export default function TheatersPage() {
    const router = useRouter()
    const [items, setItems] = useState<Theater[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!readToken()) {
            router.replace('/login')
            return
        }

        api.get<TheatersPage>('/theaters?size=50&orderby=createdAt:desc')
            .then((page) => setItems(page.items))
            .catch((err) => {
                if (err instanceof ApiError && err.status === 401) {
                    clearSession()
                    router.replace('/login')
                    return
                }
                setError(err instanceof Error ? err.message : '극장 목록을 불러올 수 없다')
            })
    }, [router])

    if (error) {
        return <main className="mx-auto max-w-3xl px-6 py-10 text-sm text-red-600">{error}</main>
    }
    if (items === null) {
        return (
            <main className="mx-auto max-w-3xl px-6 py-10 text-sm text-slate-500">
                불러오는 중…
            </main>
        )
    }

    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <header className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-semibold">극장 목록</h1>
                <Link
                    href="/theaters/new"
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                >
                    새 극장 등록
                </Link>
            </header>
            {items.length === 0 ? (
                <p className="text-sm text-slate-500">등록된 극장이 없다</p>
            ) : (
                <ul className="grid gap-3" data-testid="theater-list">
                    {items.map((theater) => (
                        <li
                            key={theater.id}
                            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                        >
                            <p className="text-base font-medium">{theater.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                                위도 {theater.location.latitude} · 경도 {theater.location.longitude}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    )
}
