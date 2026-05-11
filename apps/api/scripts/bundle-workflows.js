/**
 * showtime-creation 워크플로우를 한 덩어리 JS 문자열로 미리 번들합니다.
 * 운영 환경의 Temporal 워커가 시작할 때 이 파일을 그대로 읽어 사용합니다.
 *
 * `bundleWorkflowCode`는 워크플로우 소스(또는 컴파일 결과)가 실제 파일
 * 시스템에 있어야 동작합니다. webpack이 앱을 한 `_output/dist/index.js`
 * 로 묶고 나면 `require.resolve('./temporal/workflows')`가 null을 반환합니다.
 * 번들에는 그 파일이 더 이상 없기 때문입니다. 그 상태로 `Worker.create`
 * 를 부르면 "path must be a string" 으로 실패합니다. 빌드 단계에서 미리 번들을
 * 만들어 두는 이유입니다.
 *
 * `npm run bundle`에서 이 스크립트를 호출합니다. 결과 파일은
 * `TemporalWorkerService`가 `workflowBundlePath` 옵션으로 받아서 읽습니다.
 */
const { bundleWorkflowCode } = require('@temporalio/worker')
const fs = require('fs')
const path = require('path')

const SRC_WORKFLOWS = path.resolve(
    __dirname,
    '../src/services/application/showtime-creation/temporal/workflows.ts'
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
