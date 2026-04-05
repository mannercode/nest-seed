export class Base64 {
    static toHex(base64: string): string {
        return Buffer.from(base64, 'base64').toString('hex')
    }

    static fromHex(hex: string): string {
        return Buffer.from(hex, 'hex').toString('base64')
    }
}
