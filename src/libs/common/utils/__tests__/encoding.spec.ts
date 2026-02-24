import { base64ToHex, hexToBase64 } from 'common'

describe('hexToBase64 and base64ToHex', () => {
    // hex를 base64로 변환한다
    it('converts hex to base64', () => {
        expect(hexToBase64('68656c6c6f')).toBe('aGVsbG8=')
    })

    // base64를 hex로 변환한다
    it('converts base64 to hex', () => {
        expect(base64ToHex('aGVsbG8=')).toBe('68656c6c6f')
    })
})
