import p from 'path'
import type { Checksum } from 'common'

export type FixtureFile = {
    path: string
    originalName: string
    size: number
    mimeType: string
    checksum: Checksum
}

// openssl dgst -sha256 -binary image.file | base64
export const fixtureFiles = {
    image: {
        path: p.join(__dirname, 'image.file'),
        originalName: 'image.png',
        size: 170550,
        mimeType: 'image/png',
        checksum: { algorithm: 'sha256', base64: 'd5l1XdGa5zgerERd5V5xMR0X0mbMoZvJL1liTH1to2A=' }
    },
    json: {
        path: p.join(__dirname, 'json.file'),
        originalName: 'file.json',
        size: 25,
        mimeType: 'application/json',
        checksum: { algorithm: 'sha256', base64: 'E/DKlGNHHFTozVxark+42DQ8foyJ8QTc8TYKHWep7LQ=' }
    },
    small: {
        path: p.join(__dirname, 'small.file'),
        originalName: 'small.txt',
        size: 1024,
        mimeType: 'text/plain',
        checksum: { algorithm: 'sha256', base64: '0s1ijb9PqzNOE9THlh1xuxmpgrzJMcquMs/8vxnaDL8=' }
    },
    large: {
        path: p.join(__dirname, 'large.file'),
        originalName: 'large.txt',
        size: 4999999,
        mimeType: 'text/plain',
        checksum: { algorithm: 'sha256', base64: 'mvSFmJv2R7yO16vXaQp6HDtrnh/fBTXgm9sKtSVR0/I=' }
    },
    oversized: {
        path: p.join(__dirname, 'oversized.file'),
        originalName: 'oversized.txt',
        size: 5000000,
        mimeType: 'text/plain',
        checksum: { algorithm: 'sha256', base64: 'f0ooUZNXPnB/y2OYIiwA8ER0XNKTDkHSjTDah9bKGD8=' }
    }
} as const
