import { Base64 } from '../base64'

describe('Base64', () => {
    it('hex를 base64로 변환한다', () => {
        expect(Base64.fromHex('68656c6c6f')).toBe('aGVsbG8=')
    })

    it('base64를 hex로 변환한다', () => {
        expect(Base64.toHex('aGVsbG8=')).toBe('68656c6c6f')
    })
})
