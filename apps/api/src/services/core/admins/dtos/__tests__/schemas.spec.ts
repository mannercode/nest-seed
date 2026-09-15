import {
    AdminAuthPayloadSchema,
    AdminCredentialsSchema,
    AdminRefreshTokenBodySchema,
    CreateAdminSchema,
    UpdateAdminSchema
} from '../index.js'

describe('AdminAuthPayloadSchema, AdminCredentialsSchema, AdminRefreshTokenBodySchema, CreateAdminSchema, UpdateAdminSchema', () => {
    it('문자열 필드에 들어온 숫자와 불리언은 거부한다', () => {
        expect(
            AdminCredentialsSchema.safeParse({ email: 'admin@mail.com', password: 1234 }).success
        ).toBe(false)
        expect(AdminRefreshTokenBodySchema.safeParse({ refreshToken: true }).success).toBe(false)
    })

    it('생성 필드의 빈 문자열과 알 수 없는 필드를 거부한다', () => {
        expect(
            CreateAdminSchema.safeParse({ email: 'admin@mail.com', name: '', password: 'password' })
                .success
        ).toBe(false)
        expect(
            CreateAdminSchema.safeParse({
                email: 'admin@mail.com',
                extra: 'value',
                name: 'admin',
                password: 'password'
            }).success
        ).toBe(false)
    })

    it('수정 필드의 누락은 허용하고 null은 거부한다', () => {
        expect(UpdateAdminSchema.parse({})).toEqual({})
        expect(
            UpdateAdminSchema.safeParse({ email: null, name: null, password: null }).success
        ).toBe(false)
    })

    it('JWT 전용 부가 claim은 허용하되 필요한 claim만 반환한다', () => {
        expect(
            AdminAuthPayloadSchema.parse({ email: 'admin@mail.com', exp: 1, sub: 'admin-id' })
        ).toEqual({ email: 'admin@mail.com', sub: 'admin-id' })
        expect(AdminAuthPayloadSchema.safeParse({ email: 'admin@mail.com' }).success).toBe(false)
    })
})
