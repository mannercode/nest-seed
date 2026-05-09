/**
 * showtime-creation workflow 를 production runtime 이 시작 시 로드하는
 * 단일 JS 문자열로 미리 번들링한다.
 *
 * Why: `bundleWorkflowCode` 는 workflow 소스 (또는 컴파일된 JS) 의 실제
 * 파일시스템 경로가 필요하다. webpack 으로 모든 걸 하나의
 * `_output/dist/index.js` 에 말아넣은 뒤에는 `require.resolve('./temporal/workflows')`
 * 가 null 을 반환하고 (번들 경로에 더 이상 그 파일이 없음) Worker.create 가
 * "path must be a string" 으로 실패한다.
 *
 * `npm run bundle` 에서 호출된다. 결과물은 `workflowBundlePath` 가 주어졌을
 * 때 TemporalWorkerService 가 읽는다.
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
