import { readFile } from 'node:fs/promises'
import { UserRegistrationService } from '#application'
import { AssetsService } from '#infrastructure'
import { WebHomeViewSchema } from '#view'
import {
    buildCreateUserDto,
    buildCreateAssetDto,
    createAppTestContext,
    createAndLoginUser,
    createUser,
    loginUser,
    testAssets,
    uploadAsset,
    type AppTestContext
} from '../helpers/index.js'

describe('WebHomeViewService', () => {
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
        beforeEach(async () => {
            session = await createAndLoginUser(fix)
            await createUser(fix, { email: 'other@mail.com', name: '다른 사용자' })
        })
        it('홈을 조회하면 로그인한 본인만 반환하고 자산을 조회하지 않는다', async () => {
            const spy = vi.spyOn(fix.module.get(AssetsService), 'getMany')
            await fix.httpClient
                .get('/views/web/home')
                .headers({ Authorization: 'Bearer ' + session.accessToken })
                .query({ userId: 'other' })
                .ok({ schema: WebHomeViewSchema, expected: { user: session.user, photoUrl: null } })
            expect(spy).not.toHaveBeenCalled()
        })
    })
    describe('사진을 첨부한 사용자가 로그인했으면', () => {
        let token: string
        let assetId: string
        let userId: string
        beforeEach(async () => {
            const registration = fix.module.get(UserRegistrationService)
            const upload = await registration.createPhotoUpload({
                ...buildCreateAssetDto(),
                mimeType: 'image/png' as const
            })
            expect((await uploadAsset(testAssets.image.path, upload)).ok).toBe(true)
            assetId = upload.assetId
            const input = buildCreateUserDto()
            userId = (await registration.register({ ...input, photoAssetId: assetId })).id
            token = (await loginUser(fix, { email: input.email, password: input.password }))
                .accessToken
        })
        it('본인 사진만 조회하고 실제로 내려받을 수 있는 URL을 반환한다', async () => {
            const spy = vi.spyOn(fix.module.get(AssetsService), 'getMany')
            const { body } = await fix.httpClient
                .get('/views/web/home')
                .headers({ Authorization: 'Bearer ' + token })
                .ok({ schema: WebHomeViewSchema })
            expect(body.user.id).toBe(userId)
            expect(spy).toHaveBeenCalledExactlyOnceWith([assetId])
            const response = await fetch(body.photoUrl!)
            expect(response.ok).toBe(true)
            expect(Buffer.from(await response.arrayBuffer())).toEqual(
                await readFile(testAssets.image.path)
            )
        })
    })
})
