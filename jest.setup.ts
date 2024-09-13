import { createHash } from 'crypto'
import { exit } from 'process'

if (process.env.NODE_ENV !== 'development') {
    console.log('Cannot run tests in not development mode')
    exit(1)
}

process.env.MONGOMS_DOWNLOAD_URL =
    'https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian11-7.0.12.tgz'
process.env.MONGOMS_VERSION = '7.0.12'

global.beforeAll(async () => {
    const testPath = expect.getState().testPath ?? ''
    const uniqueId = createHash('md5').update(testPath).digest('hex')

    ;(global as any).JEST_UNIQUE_ID = uniqueId
})
