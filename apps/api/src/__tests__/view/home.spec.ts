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
    describe('인증하지 않았으면', () => {
        it('401을 반환한다', async () => {
            await fix.httpClient.get('/views/web/home').unauthorized()
        })
    })
    describe('사진 없이 가입한 사용자가 로그인한 상태에서', () => {
        let session: Awaited<ReturnType<typeof createAndLoginUser>>
        let otherUserId: string
        beforeEach(async () => {
            session = await createAndLoginUser(fix)
            otherUserId = (await createUser(fix, { email: 'other@mail.com', name: '다른 사용자' }))
                .id
        })
        it('다른 사용자 ID를 지정해도 본인 정보를 반환하고 photoUrl은 null이다', async () => {
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
        it('각자 본인 정보와 자기 사진의 다운로드 URL을 받는다', async () => {
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
