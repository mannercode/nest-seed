import {
    AdminAuthPayloadSchema,
    AdminCredentialsSchema,
    AdminRefreshTokenBodySchema,
    CreateAdminSchema,
    UpdateAdminSchema
} from '../index.js'

describe('AdminAuthPayloadSchema, AdminCredentialsSchema, AdminRefreshTokenBodySchema, CreateAdminSchema, UpdateAdminSchema', () => {
    it('문자열 필드의 기존 암시적 변환을 유지한다', () => {
        expect(AdminCredentialsSchema.parse({ email: 'admin@mail.com', password: 1234 })).toEqual({
            email: 'admin@mail.com',
            password: '1234'
        })
        expect(AdminRefreshTokenBodySchema.parse({ refreshToken: true })).toEqual({
            refreshToken: 'true'
        })
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

    it('수정 필드의 누락과 null을 모두 허용한다', () => {
        expect(UpdateAdminSchema.parse({})).toEqual({})
        expect(UpdateAdminSchema.parse({ email: null, name: null, password: null })).toEqual({
            email: null,
            name: null,
            password: null
        })
    })

    it('JWT 전용 부가 claim은 허용하되 필요한 claim만 반환한다', () => {
        expect(
            AdminAuthPayloadSchema.parse({
                authVersion: 0,
                email: 'admin@mail.com',
                exp: 1,
                sub: 'admin-id'
            })
        ).toEqual({ authVersion: 0, email: 'admin@mail.com', sub: 'admin-id' })
        expect(
            AdminAuthPayloadSchema.safeParse({ email: 'admin@mail.com', sub: 'admin-id' }).success
        ).toBe(false)
    })
})
