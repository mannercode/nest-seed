import { Path } from 'common'
import fs from 'fs'

export interface TestFile {
    path: string
    size: number
    originalName: string
    mimeType: string
}

export const TestFiles = {
    image: {
        path: Path.join(__dirname, 'res', 'image.png'),
        size: 0,
        originalName: 'image.png',
        mimeType: 'image/png'
    },
    json: {
        path: Path.join(__dirname, 'res', 'file.json'),
        size: 0,
        originalName: 'file.json',
        mimeType: 'application/json'
    },
    small: {
        path: Path.join(__dirname, 'res', 'small.txt'),
        size: 0,
        originalName: 'small.txt',
        mimeType: 'text/plain'
    },
    large: {
        path: Path.join(__dirname, 'res', 'large.txt'),
        size: 0,
        originalName: 'large.txt',
        mimeType: 'text/plain'
    },
    oversized: {
        path: Path.join(__dirname, 'res', 'oversized.txt'),
        size: 0,
        originalName: 'oversized.txt',
        mimeType: 'text/plain'
    }
}

// size update
for (const key in TestFiles) {
    if (TestFiles.hasOwnProperty(key)) {
        const file = (TestFiles as any)[key]
        file.size = fs.statSync(file.path).size
    }
}
