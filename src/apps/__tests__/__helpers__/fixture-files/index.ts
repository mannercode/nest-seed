import p from 'path'

export interface FixtureFile {
    path: string
    originalName: string
    size: number
    mimeType: string
    checksum: { algorithm: 'sha256'; hex: string }
}

export const fixtureFiles = {
    image: {
        path: p.join(__dirname, 'image.png'),
        originalName: 'image.png',
        size: 170550,
        mimeType: 'image/png',
        checksum: {
            algorithm: 'sha256',
            hex: '7799755dd19ae7381eac445de55e71311d17d266cca19bc92f59624c7d6da360'
        }
    },
    json: {
        path: p.join(__dirname, 'file.json'),
        originalName: 'file.json',
        size: 29,
        mimeType: 'application/json',
        checksum: {
            algorithm: 'sha256',
            hex: 'c8ab6f8b3a6f67807d5e9af2fa8a1bf0329433cfa5b31de1d5bbcc6ae174ff1d'
        }
    },
    small: {
        path: p.join(__dirname, 'small.txt'),
        originalName: 'small.txt',
        size: 1024,
        mimeType: 'text/plain',
        checksum: {
            algorithm: 'sha256',
            hex: 'd2cd628dbf4fab334e13d4c7961d71bb19a982bcc931caae32cffcbf19da0cbf'
        }
    },
    large: {
        path: p.join(__dirname, 'large.txt'),
        originalName: 'large.txt',
        size: 4999999,
        mimeType: 'text/plain',
        checksum: {
            algorithm: 'sha256',
            hex: '9af485989bf647bc8ed7abd7690a7a1c3b6b9e1fdf0535e09bdb0ab52551d3f2'
        }
    },
    oversized: {
        path: p.join(__dirname, 'oversized.txt'),
        originalName: 'oversized.txt',
        size: 5000000,
        mimeType: 'text/plain',
        checksum: {
            algorithm: 'sha256',
            hex: '7f4a285193573e707fcb6398222c00f044745cd2930e41d28d30da87d6ca183f'
        }
    }
} as const
