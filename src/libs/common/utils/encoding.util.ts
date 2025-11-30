export function hexToBase64(hex: string): string {
    return Buffer.from(hex, 'hex').toString('base64')
}

export function base64ToHex(base64: string): string {
    return Buffer.from(base64, 'base64').toString('hex')
}
