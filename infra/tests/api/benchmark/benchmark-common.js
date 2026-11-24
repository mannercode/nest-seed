import crypto from 'k6/crypto'

export function positiveInteger(name, defaultValue) {
    const raw = __ENV[name]
    if (raw === undefined || raw === '') return defaultValue

    const value = Number(raw)
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`)
    }
    return value
}

export function randomHex(byteLength = 8) {
    return Array.from(new Uint8Array(crypto.randomBytes(byteLength)), (byte) =>
        byte.toString(16).padStart(2, '0')
    ).join('')
}

export function summaryOutput(data) {
    const path = __ENV.SUMMARY_PATH
    if (!path) throw new Error('SUMMARY_PATH must be set')

    return { [path]: JSON.stringify(data, null, 2) }
}
