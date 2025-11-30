import { base64ToHex, hexToBase64 } from 'common'

describe('Encoding Utils', () => {
    it('converts hex to base64', () => {
        expect(hexToBase64('68656c6c6f')).toBe('aGVsbG8=')
    })

    it('converts base64 to hex', () => {
        expect(base64ToHex('aGVsbG8=')).toBe('68656c6c6f')
    })
})
