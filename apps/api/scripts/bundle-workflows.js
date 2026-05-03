/**
 * Pre-bundles the showtime-creation workflow into a single JS string
 * that the production runtime loads at startup.
 *
 * Why: `bundleWorkflowCode` needs a real filesystem path to the workflow
 * source (or compiled JS). After webpack rolls everything into one
 * `_output/dist/index.js`, `require.resolve('./temporal/workflows')`
 * returns null (the file no longer exists at the bundled path) and
 * Worker.create fails with "path must be a string".
 *
 * Hooked from `npm run bundle`. The output is read by
 * TemporalWorkerService when `workflowBundlePath` is provided.
 */
const { bundleWorkflowCode } = require('@temporalio/worker')
const fs = require('fs')
const path = require('path')

const SRC_WORKFLOWS = path.resolve(
    __dirname,
    '../src/applications/services/showtime-creation/temporal/workflows.ts'
)
const OUT_DIR = path.resolve(__dirname, '../_output/dist')
const OUT_FILE = path.join(OUT_DIR, 'showtime-creation-workflow-bundle.js')

async function main() {
    const { code } = await bundleWorkflowCode({ workflowsPath: SRC_WORKFLOWS })
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(OUT_FILE, code)
    console.log(`workflow bundle: ${OUT_FILE} (${(code.length / 1024).toFixed(0)} KB)`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
