import {
    CreateUserSchema,
    RefreshTokenBodySchema,
    SearchUsersPageSchema,
    UpdateUserSchema,
    UserAuthPayloadSchema,
    UserCredentialsSchema
} from '../index.js'

describe('CreateUserSchema, RefreshTokenBodySchema, SearchUsersPageSchema, UpdateUserSchema, UserAuthPayloadSchema, UserCredentialsSchema', () => {
    it('생년월일과 문자열 필드의 기존 암시적 변환을 유지한다', () => {
        expect(
            CreateUserSchema.parse({
                birthDate: '2000-01-02',
                email: 'user@mail.com',
                name: false,
                password: 1234
            })
        ).toEqual({
            birthDate: Temporal.PlainDate.from('2000-01-02'),
            email: 'user@mail.com',
            name: 'false',
            password: '1234'
        })
        expect(UserCredentialsSchema.parse({ email: 'user@mail.com', password: 0 })).toEqual({
            email: 'user@mail.com',
            password: '0'
        })
    })

    it('잘못된 생년월일과 빈 refresh token을 거부한다', () => {
        expect(
            CreateUserSchema.safeParse({
                birthDate: 'not-a-date',
                email: 'user@mail.com',
                name: 'user',
                password: 'password'
            }).success
        ).toBe(false)
        expect(RefreshTokenBodySchema.safeParse({ refreshToken: '' }).success).toBe(false)
    })

    it('수정 필드의 누락과 null을 모두 허용한다', () => {
        expect(UpdateUserSchema.parse({})).toEqual({})
        expect(
            UpdateUserSchema.parse({ birthDate: null, email: null, name: null, password: null })
        ).toEqual({ birthDate: null, email: null, name: null, password: null })
    })

    it('검색 쿼리를 변환하고 알 수 없는 필드를 거부한다', () => {
        expect(SearchUsersPageSchema.parse({ email: 123, name: null, page: '2' })).toEqual({
            email: '123',
            name: null,
            page: 2
        })
        expect(SearchUsersPageSchema.safeParse({ wrong: 'value' }).success).toBe(false)
    })

    it('JWT 전용 부가 claim은 허용하되 필요한 claim만 반환한다', () => {
        expect(
            UserAuthPayloadSchema.parse({
                authVersion: 0,
                email: 'user@mail.com',
                familyId: 'family-id',
                sub: 'user-id'
            })
        ).toEqual({ authVersion: 0, email: 'user@mail.com', sub: 'user-id' })
        expect(
            UserAuthPayloadSchema.safeParse({ email: 'user@mail.com', sub: 'user-id' }).success
        ).toBe(false)
    })
})
