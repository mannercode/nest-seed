import { Checksum } from 'common'
import { readFileSync } from 'fs'
import p from 'path'

export type TestAsset = {
    checksum: Checksum
    mimeType: string
    originalName: string
    path: string
    size: number
}

function loadAsset(filename: string, originalName: string, mimeType: string): TestAsset {
    const path = p.join(__dirname, filename)
    const buf = readFileSync(path)
    const size = buf.length
    const checksum = Checksum.fromBuffer(buf)

    return { checksum, mimeType, originalName, path, size }
}

export const testAssets = {
    image: loadAsset('image.file', 'image.png', 'image/png'),
    json: loadAsset('json.file', 'file.json', 'application/json'),
    large: loadAsset('large.file', 'large.txt', 'text/plain'),
    oversized: loadAsset('oversized.file', 'oversized.txt', 'text/plain'),
    small: loadAsset('small.file', 'small.txt', 'text/plain')
} as const
