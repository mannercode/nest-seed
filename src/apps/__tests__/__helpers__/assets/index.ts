import { readFileSync } from 'fs'
import p from 'path'
import { Checksum } from 'common'

export type TestAsset = {
    path: string
    originalName: string
    size: number
    mimeType: string
    checksum: Checksum
}

function loadAsset(filename: string, originalName: string, mimeType: string): TestAsset {
    const path = p.join(__dirname, filename)
    const buf = readFileSync(path)
    const size = buf.length
    const checksum = Checksum.fromBuffer(buf)

    return { path, originalName, size, mimeType, checksum }
}

export const testAssets = {
    image: loadAsset('image.file', 'image.png', 'image/png'),
    json: loadAsset('json.file', 'file.json', 'application/json'),
    small: loadAsset('small.file', 'small.txt', 'text/plain'),
    large: loadAsset('large.file', 'large.txt', 'text/plain'),
    oversized: loadAsset('oversized.file', 'oversized.txt', 'text/plain')
} as const
