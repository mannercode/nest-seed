import { HttpUtil } from 'common'

describe('HttpUtil', () => {
    describe('buildContentDisposition', () => {
        it('returns RFC5987 content-disposition for an ASCII filename', () => {
            const filename = 'hello_world-1.0.txt'
            const contentDisposition = HttpUtil.buildContentDisposition(filename)

            expect(contentDisposition).toEqual(
                `attachment; filename="hello_world-1.0.txt"; filename*=UTF-8''hello_world-1.0.txt`
            )
        })

        it('applies + and percent-encoding in filename* for spaces or special chars', () => {
            const filename = `report (final)'v1*.txt`
            const contentDisposition = HttpUtil.buildContentDisposition(filename)

            expect(contentDisposition).toEqual(
                `attachment; filename="report (final)'v1-.txt"; filename*=UTF-8''report+%28final%29%27v1%2A.txt`
            )
        })

        it('preserves filename* and replaces non-ASCII in fallback for a Unicode filename', () => {
            const filename = '한글 파일명(최종).pdf'
            const contentDisposition = HttpUtil.buildContentDisposition(filename)

            expect(contentDisposition).toEqual(
                `attachment; filename="__ ___(__).pdf"; filename*=UTF-8''%ED%95%9C%EA%B8%80+%ED%8C%8C%EC%9D%BC%EB%AA%85%28%EC%B5%9C%EC%A2%85%29.pdf`
            )
        })

        it('replaces forbidden characters with "-" in fallback for a filename with forbidden characters', () => {
            const filename = 'bad:/\\?%*:|"<>name.txt'
            const contentDisposition = HttpUtil.buildContentDisposition(filename)

            expect(contentDisposition).toEqual(
                `attachment; filename="bad-----------name.txt"; filename*=UTF-8''bad%3A%2F%5C%3F%25%2A%3A%7C%22%3C%3Ename.txt`
            )
        })

        it('uses + for spaces in filename* for an ASCII filename with spaces', () => {
            const filename = 'my file name.txt'
            const contentDisposition = HttpUtil.buildContentDisposition(filename)

            expect(contentDisposition).toEqual(
                `attachment; filename="my file name.txt"; filename*=UTF-8''my+file+name.txt`
            )
        })

        it('defaults the fallback filename to "file" for an empty filename', () => {
            const filename = ''
            const contentDisposition = HttpUtil.buildContentDisposition(filename)

            expect(contentDisposition).toEqual(`attachment; filename="file"; filename*=UTF-8''`)
        })
    })

    describe('extractContentDisposition', () => {
        it('extracts the quoted filename when only a quoted filename exists', () => {
            const contentDisposition = `attachment; filename="ascii-name.txt"`
            expect(HttpUtil.extractContentDisposition(contentDisposition)).toBe('ascii-name.txt')
        })

        it('extracts the bare filename when only a bare filename exists', () => {
            const contentDisposition = `inline; filename=bare-name.csv`
            expect(HttpUtil.extractContentDisposition(contentDisposition)).toBe('bare-name.csv')
        })

        it('returns "unknown" for an invalid or missing header', () => {
            expect(HttpUtil.extractContentDisposition('')).toBe('unknown')
            expect(HttpUtil.extractContentDisposition('attachment')).toBe('unknown')
            expect(HttpUtil.extractContentDisposition('inline; foo=bar')).toBe('unknown')
        })

        it('falls back to the quoted or bare value when filename* decoding fails', () => {
            const badStar = `attachment; filename*=UTF-8''%E0%A4%ZZ; filename="safe-fallback.txt"`
            expect(HttpUtil.extractContentDisposition(badStar)).toBe('safe-fallback.txt')

            const badStarNoQuoted = `attachment; filename*=UTF-8''%E0%A4%ZZ; filename=bare-fallback.txt`
            expect(HttpUtil.extractContentDisposition(badStarNoQuoted)).toBe('bare-fallback.txt')
        })
    })
})
