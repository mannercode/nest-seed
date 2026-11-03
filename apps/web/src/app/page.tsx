'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ApiError, getJson, postJson } from '@/lib/api-client'
import { photoUrl } from '@/lib/photos'

type HomeView = {
    user: {
        id: string
        name: string
        email: string
        birthDate: string
        photoAssetId: string | null
    }
    photoUrl: string | null
}
export default function HomePage() {
    const [home, setHome] = useState<HomeView | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [loggingOut, setLoggingOut] = useState(false)
    useEffect(() => {
        let cancelled = false
        async function load() {
            try {
                const result = await getJson<HomeView>('/views/web/home')
                if (!cancelled) setHome(result)
            } catch (err) {
                if (!cancelled && !(err instanceof ApiError && err.status === 401))
                    setError(err instanceof Error ? err.message : '내 정보를 불러올 수 없습니다.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        void load()
        return () => {
            cancelled = true
        }
    }, [])
    async function onLogout() {
        setLoggingOut(true)
        setError(null)
        try {
            await postJson('/users/logout', {})
            setHome(null)
        } catch (err) {
            setHome(null)
            setError(err instanceof Error ? err.message : '로그아웃에 실패했습니다.')
        } finally {
            setLoggingOut(false)
        }
    }
    return (
        <main className="mx-auto max-w-xl px-6 py-12">
            <h1 className="text-2xl font-semibold">내 정보</h1>
            {error ? (
                <p role="alert" className="mt-4 text-sm text-red-600">
                    {error}
                </p>
            ) : null}
            {loading ? (
                <p className="mt-6 text-slate-500">불러오는 중…</p>
            ) : home ? (
                <section className="mt-6 rounded-xl bg-white p-6 shadow">
                    {home.photoUrl ? (
                        <Image
                            src={photoUrl(home.photoUrl)}
                            alt={home.user.name + '의 프로필 사진'}
                            width={128}
                            height={128}
                            unoptimized
                            className="mb-6 rounded-lg object-cover"
                        />
                    ) : (
                        <p className="mb-6 text-sm text-slate-500">등록한 사진이 없습니다.</p>
                    )}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
                        <dt>이름</dt>
                        <dd>{home.user.name}</dd>
                        <dt>이메일</dt>
                        <dd>{home.user.email}</dd>
                        <dt>생년월일</dt>
                        <dd>{home.user.birthDate}</dd>
                    </dl>
                    <button
                        type="button"
                        onClick={() => void onLogout()}
                        disabled={loggingOut}
                        className="mt-8 underline"
                    >
                        {loggingOut ? '로그아웃 중…' : '로그아웃'}
                    </button>
                </section>
            ) : (
                <section className="mt-6">
                    <p>로그인하면 내 정보와 사진을 확인할 수 있습니다.</p>
                    <nav className="mt-4 flex gap-4">
                        <Link href="/login" className="underline">
                            로그인
                        </Link>
                        <Link href="/signup" className="underline">
                            회원가입
                        </Link>
                    </nav>
                </section>
            )}
        </main>
    )
}
