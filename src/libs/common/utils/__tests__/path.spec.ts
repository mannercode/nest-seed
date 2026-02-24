import { Path } from 'common'
import os from 'os'
import p from 'path'

describe('Path', () => {
    // 절대 경로를 반환한다
    it('returns an absolute path', async () => {
        const relativePath = `.${Path.sep()}file.txt`
        const absolutePath = Path.getAbsolute(relativePath)

        expect(p.isAbsolute(absolutePath)).toBe(true)
    })

    // 경로가 이미 절대 경로일 때
    describe('when the path is already absolute', () => {
        let absolutePath: string

        beforeEach(() => {
            absolutePath = p.join(os.tmpdir(), 'file.txt')
        })

        // 같은 경로를 반환한다
        it('returns the same path', async () => {
            const result = Path.getAbsolute(absolutePath)

            expect(result).toEqual(absolutePath)
        })
    })

    // basename을 반환한다
    it('returns the basename', () => {
        const filePath = 'dir/file.txt'
        const basename = Path.basename(filePath)

        expect(basename).toEqual('file.txt')
    })

    // dirname을 반환한다
    it('returns the dirname', () => {
        const filePath = 'dir/file.txt'
        const dirname = Path.dirname(filePath)

        expect(dirname).toEqual('dir')
    })
})
