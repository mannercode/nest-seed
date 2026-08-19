import { expect, request, test, type BrowserContext, type Page } from '@playwright/test'
import { MongoClient, ObjectId } from 'mongodb'
import { randomUUID } from 'node:crypto'

import { API_BASE_URL, USER_APP_BASE_URL } from '../playwright.config'

const PASSWORD = 'DevPass1!'
const CROSS_ROLE_ADMIN_EMAIL = 'user-app-cross-role-admin@nest-seed.local'
const CROSS_ROLE_ADMIN_NAME = 'User App Cross Role Admin'
const ACCESS_COOKIE = 'nest-seed-user-access'
const REFRESH_COOKIE = 'nest-seed-user-refresh'

const rootPassword = process.env.ROOT_PASSWORD
if (!rootPassword) {
    throw new Error('ROOT_PASSWORD must be set (devcontainer ambient env에서 주입된다)')
}
const ROOT_BASIC_AUTH = `Basic ${Buffer.from(`root:${rootPassword}`).toString('base64')}`
const mongoUri = process.env.MONGO_URI
const mongoDatabase = process.env.MONGO_DATABASE
if (!mongoUri || !mongoDatabase) {
    throw new Error('MONGO_URI and MONGO_DATABASE must be set')
}

test.beforeAll(async () => {
    const api = await request.newContext()
    try {
        const response = await api.post(`${API_BASE_URL}/admins`, {
            data: {
                email: CROSS_ROLE_ADMIN_EMAIL,
                name: CROSS_ROLE_ADMIN_NAME,
                password: PASSWORD
            },
            headers: { Authorization: ROOT_BASIC_AUTH }
        })
        if (!response.ok() && response.status() !== 409) {
            throw new Error(
                `cross-role admin creation failed: ${response.status()} ${await response.text()}`
            )
        }
    } finally {
        await api.dispose()
    }
})

async function signupAndLogin(page: Page): Promise<string> {
    const email = `e2e-user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`

    await page.goto(`${USER_APP_BASE_URL}/signup`)
    await page.getByRole('textbox', { name: '이름' }).fill('E2E User')
    await page.getByRole('textbox', { name: '이메일' }).fill(email)
    await page.getByLabel('비밀번호').fill(PASSWORD)
    await page.getByRole('button', { name: '회원가입' }).click()
    await expect(page).toHaveURL(`${USER_APP_BASE_URL}/login`)

    await page.getByRole('textbox', { name: '이메일' }).fill(email)
    await page.getByLabel('비밀번호').fill(PASSWORD)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).toHaveURL(`${USER_APP_BASE_URL}/`)

    return email
}

async function getSessionCookie(context: BrowserContext, name: string) {
    const cookies = await context.cookies(USER_APP_BASE_URL)
    return cookies.find((cookie) => cookie.name === name)
}

test('교차 역할 관리자 로그인 경로는 user BFF에서 토큰을 노출하지 않고 404다', async ({ page }) => {
    await page.goto(`${USER_APP_BASE_URL}/login`)

    const result = await page.evaluate(
        async ({ email, password }) => {
            const response = await fetch('/api/admins/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })
            const body = await response.text()
            return {
                exposesToken: /"(?:accessToken|refreshToken)"\s*:/.test(body),
                status: response.status
            }
        },
        { email: CROSS_ROLE_ADMIN_EMAIL, password: PASSWORD }
    )

    expect(result).toEqual({ exposesToken: false, status: 404 })
})

test('사용자 refresh 직접 호출은 user BFF에서 404다', async ({ page }) => {
    await page.goto(`${USER_APP_BASE_URL}/login`)

    const result = await page.evaluate(async () => {
        const response = await fetch('/api/users/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: 'client-controlled-refresh-token' })
        })
        const body = await response.text()
        return {
            exposesToken: /"(?:accessToken|refreshToken)"\s*:/.test(body),
            status: response.status
        }
    })

    expect(result).toEqual({ exposesToken: false, status: 404 })
})

test('사용자 로그인 세션으로 보호 API와 개인화 홈을 요청한다', async ({ page }) => {
    const client = new MongoClient(mongoUri)
    const actionMovieId = new ObjectId()
    const dramaMovieId = new ObjectId()
    const watchedActionMovieId = new ObjectId()
    const theaterId = new ObjectId()
    const showtimeIds = [new ObjectId(), new ObjectId()]
    const watchRecordId = new ObjectId()
    const runId = randomUUID()
    const now = new Date()
    const actionReleaseDate = new Date('2099-01-01T00:00:00.000Z')
    const dramaReleaseDate = new Date('2099-02-01T00:00:00.000Z')
    const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000)
    let userId: string | undefined

    await client.connect()
    const db = client.db(mongoDatabase)
    try {
        const movieBase = {
            assetIds: [],
            createdAt: now,
            deletedAt: null,
            director: `e2e-director-${runId}`,
            durationInSeconds: 7200,
            isPublished: true,
            plot: `e2e-plot-${runId}`,
            rating: 'PG',
            updatedAt: now,
            __v: 0
        }
        await db.collection('movies').insertMany([
            {
                ...movieBase,
                _id: actionMovieId,
                genres: ['action'],
                releaseDate: actionReleaseDate,
                title: `E2E personalized action ${runId}`
            },
            {
                ...movieBase,
                _id: dramaMovieId,
                genres: ['drama'],
                releaseDate: dramaReleaseDate,
                title: `E2E personalized drama ${runId}`
            },
            {
                ...movieBase,
                _id: watchedActionMovieId,
                genres: ['action'],
                releaseDate: new Date('2098-01-01T00:00:00.000Z'),
                title: `E2E watched action ${runId}`
            }
        ])
        await db
            .collection('theaters')
            .insertOne({
                _id: theaterId,
                createdAt: now,
                deletedAt: null,
                location: { latitude: 37.55, longitude: 126.99 },
                name: `E2E personalized theater ${runId}`,
                seatmap: { blocks: [{ name: 'A', rows: [{ layout: 'O', name: '1' }] }] },
                showtimeScheduleVersion: 0,
                updatedAt: now,
                __v: 0
            })
        await db.collection('showtimes').insertMany([
            {
                _id: showtimeIds[0],
                createdAt: now,
                endTime,
                movieId: actionMovieId.toHexString(),
                sagaId: `e2e-home-action-${runId}`,
                startTime,
                theaterId: theaterId.toHexString(),
                updatedAt: now,
                __v: 0
            },
            {
                _id: showtimeIds[1],
                createdAt: now,
                endTime,
                movieId: dramaMovieId.toHexString(),
                sagaId: `e2e-home-drama-${runId}`,
                startTime,
                theaterId: theaterId.toHexString(),
                updatedAt: now,
                __v: 0
            }
        ])

        await page.goto(USER_APP_BASE_URL)
        const guestHome = await page.evaluate(async () => {
            const response = await fetch('/api/views/user-app/home')
            return {
                body: (await response.json()) as { recommendedMovies: Array<{ id: string }> },
                status: response.status
            }
        })
        expect(guestHome.status).toBe(200)
        const guestIds = guestHome.body.recommendedMovies.map((movie) => movie.id)
        expect(guestIds).toEqual(
            expect.arrayContaining([dramaMovieId.toHexString(), actionMovieId.toHexString()])
        )
        expect(guestIds.indexOf(dramaMovieId.toHexString())).toBeLessThan(
            guestIds.indexOf(actionMovieId.toHexString())
        )

        const email = await signupAndLogin(page)
        const me = await page.evaluate(async () => {
            const response = await fetch('/api/users/me')
            return {
                body: (await response.json()) as { email: string; id: string },
                status: response.status
            }
        })
        expect(me.status).toBe(200)
        expect(me.body).toMatchObject({ email })
        userId = me.body.id

        await db
            .collection('watchrecords')
            .insertOne({
                _id: watchRecordId,
                createdAt: now,
                deletedAt: null,
                movieId: watchedActionMovieId.toHexString(),
                purchaseRecordId: new ObjectId().toHexString(),
                updatedAt: now,
                userId,
                watchDate: now,
                __v: 0
            })

        const authenticatedHome = await page.evaluate(async () => {
            const response = await fetch('/api/views/user-app/home')
            return {
                body: (await response.json()) as { recommendedMovies: Array<{ id: string }> },
                status: response.status
            }
        })
        expect(authenticatedHome.status).toBe(200)
        const authenticatedIds = authenticatedHome.body.recommendedMovies.map((movie) => movie.id)
        expect(authenticatedIds).toEqual(
            expect.arrayContaining([actionMovieId.toHexString(), dramaMovieId.toHexString()])
        )
        // BFF가 access cookie를 Bearer로 전달하지 않으면 API는 guest로 처리해
        // 최신 drama가 계속 앞서므로 이 개인화 순서 계약이 실패한다.
        expect(authenticatedIds.indexOf(actionMovieId.toHexString())).toBeLessThan(
            authenticatedIds.indexOf(dramaMovieId.toHexString())
        )
        await expect(page.getByText(email)).toBeVisible()
    } finally {
        if (userId) {
            await page
                .evaluate(async () => {
                    await fetch('/api/users/logout', { method: 'POST' }).catch(() => undefined)
                })
                .catch(() => undefined)
        }
        await Promise.all([
            db.collection('watchrecords').deleteOne({ _id: watchRecordId }),
            db.collection('showtimes').deleteMany({ _id: { $in: showtimeIds } }),
            db
                .collection('movies')
                .deleteMany({ _id: { $in: [actionMovieId, dramaMovieId, watchedActionMovieId] } }),
            db.collection('theaters').deleteOne({ _id: theaterId }),
            userId
                ? db.collection('users').deleteOne({ _id: new ObjectId(userId) })
                : Promise.resolve()
        ])
        await client.close()
    }
})

test('access 토큰이 만료되면 refresh 토큰을 회전하고 원 요청을 한 번 재시도한다', async ({
    context,
    page
}) => {
    await signupAndLogin(page)

    const accessCookie = await getSessionCookie(context, ACCESS_COOKIE)
    const refreshCookieBefore = await getSessionCookie(context, REFRESH_COOKIE)
    expect(accessCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' })
    expect(refreshCookieBefore).toMatchObject({ httpOnly: true, sameSite: 'Lax' })

    await context.addCookies([{ ...accessCookie!, value: 'expired-access-token' }])

    const status = await page.evaluate(async () => (await fetch('/api/users/me')).status)
    expect(status).toBe(200)

    const accessCookieAfter = await getSessionCookie(context, ACCESS_COOKIE)
    const refreshCookieAfter = await getSessionCookie(context, REFRESH_COOKIE)
    expect(accessCookieAfter?.value).not.toBe('expired-access-token')
    expect(refreshCookieAfter?.value).not.toBe(refreshCookieBefore?.value)
})

test('로그아웃은 브라우저 쿠키를 지우고 서버 refresh 토큰도 폐기한다', async ({
    context,
    page
}) => {
    await signupAndLogin(page)

    const refreshCookie = await getSessionCookie(context, REFRESH_COOKIE)
    expect(refreshCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' })

    await page.getByRole('button', { name: '로그아웃' }).click()

    await expect.poll(async () => getSessionCookie(context, ACCESS_COOKIE)).toBeUndefined()
    expect(await getSessionCookie(context, REFRESH_COOKIE)).toBeUndefined()
    expect(await page.evaluate(async () => (await fetch('/api/users/me')).status)).toBe(401)

    const api = await request.newContext()
    try {
        const response = await api.post(`${API_BASE_URL}/users/refresh`, {
            data: { refreshToken: refreshCookie!.value }
        })
        expect(response.status()).toBe(401)
    } finally {
        await api.dispose()
    }
})
