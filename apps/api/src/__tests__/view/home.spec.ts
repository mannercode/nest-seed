import { Checksum } from '@mannercode/common'
import { readFile } from 'node:fs/promises'
import { UserSchema } from '#core'
import { WebHomeViewSchema } from '#view'
import {
    buildCreateUserDto,
    createAppTestContext,
    createAndLoginUser,
    createUser,
    loginUser,
    requestRegistrationPhotoUpload,
    testAssets,
    uploadAsset,
    type AppTestContext
} from '#test-helpers'

async function registerWithPhoto(fix: AppTestContext, email: string, photo: Buffer<ArrayBuffer>) {
    const input = buildCreateUserDto({ email })
    const upload = await requestRegistrationPhotoUpload(fix, {
        checksum: Checksum.fromBuffer(photo),
        mimeType: 'image/png',
        originalName: 'photo.png',
        size: photo.length
    })
    const file = new File([photo], 'photo.png', { type: 'image/png' })
    expect((await uploadAsset(file, upload)).ok).toBe(true)
    const { body: user } = await fix.httpClient
        .post('/users')
        .body({ ...input, photoAssetId: upload.assetId })
        .created({ schema: UserSchema })
    const { accessToken } = await loginUser(fix, { email, password: input.password })
    return { accessToken, photo, user }
}

describe('GET /views/web/home', () => {
    let fix: AppTestContext
    beforeEach(async () => {
        fix = await createAppTestContext()
    })
    afterEach(() => fix?.teardown())
    it('인증하지 않고 홈을 조회하면 401을 반환한다', async () => {
        await fix.httpClient.get('/views/web/home').unauthorized()
    })
    describe('사진 없이 가입한 사용자가 로그인했으면', () => {
        let session: Awaited<ReturnType<typeof createAndLoginUser>>
        let otherUserId: string
        beforeEach(async () => {
            session = await createAndLoginUser(fix)
            otherUserId = (await createUser(fix, { email: 'other@mail.com', name: '다른 사용자' }))
                .id
        })
        it('다른 사용자 ID로 홈을 조회해도 본인 정보와 빈 사진 URL을 반환한다', async () => {
            await fix.httpClient
                .get('/views/web/home')
                .headers({ Authorization: 'Bearer ' + session.accessToken })
                .query({ userId: otherUserId })
                .ok({ schema: WebHomeViewSchema, expected: { user: session.user, photoUrl: null } })
        })
    })
    describe('두 사용자가 서로 다른 사진을 첨부해 가입했으면', () => {
        let first: Awaited<ReturnType<typeof registerWithPhoto>>
        let second: typeof first
        beforeEach(async () => {
            first = await registerWithPhoto(
                fix,
                'first@mail.com',
                await readFile(testAssets.image.path)
            )
            const pixel = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
                'base64'
            )
            second = await registerWithPhoto(fix, 'second@mail.com', pixel)
        })
        it('각 사용자에게 본인 정보와 본인의 사진을 내려받을 수 있는 URL을 반환한다', async () => {
            for (const [session, other] of [
                [first, second],
                [second, first]
            ] as const) {
                const { body } = await fix.httpClient
                    .get('/views/web/home')
                    .headers({ Authorization: 'Bearer ' + session.accessToken })
                    .query({ userId: other.user.id })
                    .ok({ schema: WebHomeViewSchema })
                expect(body.user).toEqual(session.user)
                const response = await fetch(body.photoUrl!)
                expect(response.status).toBe(200)
                expect(Buffer.from(await response.arrayBuffer())).toEqual(session.photo)
            }
        })
    })
})
