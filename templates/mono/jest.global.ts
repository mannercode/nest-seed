import fs from 'fs'
import { getEnv } from './jest.utils'

export default async function globalSetup() {
    const dirPath = getEnv('LOG_DIRECTORY')
    fs.mkdirSync(dirPath, { recursive: true })
}
