import { bundleWorkflowCode } from '@temporalio/worker'
import fs from 'fs'
import path from 'path'
import { showtimeCreationBundle } from '../src/workflows'

const workflows = [showtimeCreationBundle]

async function bundleWorkflows(): Promise<void> {
    for (const { sourcePath, bundlePath } of workflows) {
        const { code } = await bundleWorkflowCode({ workflowsPath: sourcePath })
        fs.mkdirSync(path.dirname(bundlePath), { recursive: true })
        fs.writeFileSync(bundlePath, code)
    }
}

bundleWorkflows().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
})
