import { Path } from 'common'
import fs from 'fs'

export interface FixtureFile {
    path: string
    size: number
    originalName: string
    mimeType: string
}

export const fixtureFiles = {
    image: {
        path: Path.join(__dirname, 'files', 'image.png'),
        size: 0,
        originalName: 'image.png',
        mimeType: 'image/png'
    },
    json: {
        path: Path.join(__dirname, 'files', 'file.json'),
        size: 0,
        originalName: 'file.json',
        mimeType: 'application/json'
    },
    small: {
        path: Path.join(__dirname, 'files', 'small.txt'),
        size: 0,
        originalName: 'small.txt',
        mimeType: 'text/plain'
    },
    large: {
        path: Path.join(__dirname, 'files', 'large.txt'),
        size: 0,
        originalName: 'large.txt',
        mimeType: 'text/plain'
    },
    oversized: {
        path: Path.join(__dirname, 'files', 'oversized.txt'),
        size: 0,
        originalName: 'oversized.txt',
        mimeType: 'text/plain'
    }
}

// size update
for (const key in fixtureFiles) {
    if (fixtureFiles.hasOwnProperty(key)) {
        const file = (fixtureFiles as any)[key]
        file.size = fs.statSync(file.path).size
    }
}
