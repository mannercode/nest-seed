import { Base64 } from '../base64'

describe('Base64', () => {
    it('16진수 문자열을 base64로 변환한다', () => {
        expect(Base64.fromHex('68656c6c6f')).toBe('aGVsbG8=')
    })

    it('base64를 16진수 문자열로 변환한다', () => {
        expect(Base64.toHex('aGVsbG8=')).toBe('68656c6c6f')
    })
})
