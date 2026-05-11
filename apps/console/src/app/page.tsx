import Link from 'next/link'

export default function HomePage() {
    return (
        <main className="flex min-h-screen items-center justify-center px-6 py-12">
            <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow">
                <header className="text-center">
                    <h1 className="text-2xl font-semibold">Nest-Seed Console</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        가입 · 로그인 · 영화 등록/조회 데모
                    </p>
                </header>
                <div className="grid gap-3">
                    <Link
                        href="/signup"
                        className="rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-700"
                    >
                        가입하기
                    </Link>
                    <Link
                        href="/login"
                        className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-900 hover:bg-slate-100"
                    >
                        로그인
                    </Link>
                    <Link
                        href="/movies"
                        className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-900 hover:bg-slate-100"
                    >
                        영화 목록
                    </Link>
                </div>
            </div>
        </main>
    )
}
