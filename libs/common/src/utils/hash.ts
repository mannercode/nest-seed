import { createHash } from 'node:crypto'

export function sha256(value: string, encoding: 'base64url' | 'hex'): string {
    return createHash('sha256').update(value).digest(encoding)
}
