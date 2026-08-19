import path from 'node:path'
import { resolveWorkflowDirectory } from '../bundle'

describe('resolveWorkflowDirectory', () => {
    it('Jest와 일반 빌드의 workflow bundle 디렉터리를 명시적으로 분리한다', () => {
        expect(resolveWorkflowDirectory('/tmp/jest-run/workflows', '/workspace/api')).toBe(
            '/tmp/jest-run/workflows'
        )
        expect(resolveWorkflowDirectory(undefined, '/workspace/api')).toBe(
            path.join('/workspace/api', '_output/workflows')
        )
    })
})
