import type { Connection } from '@temporalio/client'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import fs from 'fs'
import { getEnv, setEnv } from './jest.utils'

async function setupTemporal() {
    const testEnv = await TestWorkflowEnvironment.createLocal()
    return testEnv
}

export default async function globalSetup() {
    const dirPath = getEnv('LOG_DIRECTORY')
    fs.mkdirSync(dirPath, { recursive: true })

    const temporal = await setupTemporal()

    setEnv('TESTLIB_TEMPORAL_ADDRESS', (temporal.client.connection as Connection).options.address)
}
