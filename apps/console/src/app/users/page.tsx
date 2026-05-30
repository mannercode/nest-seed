'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ApiError, api } from '@/lib/api-client'
import { clearSession, readToken } from '@/lib/session'

type User = { id: string; name: string; email: string; birthDate: string }
type UsersPage = { items: User[]; page: number; size: number; total: number }

export default function UsersPage() {
    const router = useRouter()
    const [items, setItems] = useState<User[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!readToken()) {
            router.replace('/login')
            return
        }

        // 사용자 목록·삭제는 관리자 전용 API라 admin 토큰을 함께 보낸다.
        api.get<UsersPage>('/users?size=50&orderby=createdAt:desc', {
            accessToken: readToken() ?? undefined
        })
            .then((page) => setItems(page.items))
            .catch((err) => {
                if (err instanceof ApiError && err.status === 401) {
                    clearSession()
                    router.replace('/login')
                    return
                }
                setError(err instanceof Error ? err.message : '사용자 목록을 불러올 수 없다')
            })
    }, [router])

    async function onDelete(id: string) {
        if (!window.confirm('이 사용자를 삭제할까요?')) return
        try {
            await api.delete(`/users/${id}`, { accessToken: readToken() ?? undefined })
            setItems((prev) => (prev ? prev.filter((user) => user.id !== id) : prev))
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                clearSession()
                router.replace('/login')
                return
            }
            setError(err instanceof Error ? err.message : '삭제에 실패했다')
        }
    }

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
            <h1 className="mb-6 text-2xl font-semibold">사용자 목록</h1>
            {items.length === 0 ? (
                <p className="text-sm text-slate-500">등록된 사용자가 없다</p>
            ) : (
                <ul className="grid gap-3" data-testid="user-list">
                    {items.map((user) => (
                        <li
                            key={user.id}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                        >
                            <div>
                                <p className="text-base font-medium">{user.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onDelete(user.id)}
                                className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                            >
                                삭제
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    )
}
