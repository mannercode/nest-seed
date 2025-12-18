import { HttpUtil } from 'common'

describe('HttpUtil', () => {
    describe('buildContentDisposition', () => {
        describe('when the filename is ASCII', () => {
            it('returns RFC5987 content-disposition', () => {
                const filename = 'hello_world-1.0.txt'
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="hello_world-1.0.txt"; filename*=UTF-8''hello_world-1.0.txt`
                )
            })
        })

        describe('when the filename has spaces or special chars', () => {
            it('applies + and percent-encoding in filename*', () => {
                const filename = `report (final)'v1*.txt`
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="report (final)'v1-.txt"; filename*=UTF-8''report+%28final%29%27v1%2A.txt`
                )
            })
        })

        describe('when the filename is Unicode', () => {
            it('preserves filename* and replaces non-ASCII in fallback', () => {
                const filename = '한글 파일명(최종).pdf'
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="__ ___(__).pdf"; filename*=UTF-8''%ED%95%9C%EA%B8%80+%ED%8C%8C%EC%9D%BC%EB%AA%85%28%EC%B5%9C%EC%A2%85%29.pdf`
                )
            })
        })

        describe('when the filename has forbidden characters', () => {
            it('replaces forbidden characters with "-" in fallback', () => {
                const filename = 'bad:/\\?%*:|"<>name.txt'
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="bad-----------name.txt"; filename*=UTF-8''bad%3A%2F%5C%3F%25%2A%3A%7C%22%3C%3Ename.txt`
                )
            })
        })

        describe('when the filename is ASCII with spaces', () => {
            it('uses + for spaces in filename*', () => {
                const filename = 'my file name.txt'
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="my file name.txt"; filename*=UTF-8''my+file+name.txt`
                )
            })
        })

        describe('when the filename is empty', () => {
            it('defaults the fallback filename to "file"', () => {
                const filename = ''
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(`attachment; filename="file"; filename*=UTF-8''`)
            })
        })
    })

    describe('extractContentDisposition', () => {
        describe('when only a quoted filename exists', () => {
            it('extracts the quoted filename', () => {
                const contentDisposition = `attachment; filename="ascii-name.txt"`
                expect(HttpUtil.extractContentDisposition(contentDisposition)).toBe(
                    'ascii-name.txt'
                )
            })
        })

        describe('when only a bare filename exists', () => {
            it('extracts the bare filename', () => {
                const contentDisposition = `inline; filename=bare-name.csv`
                expect(HttpUtil.extractContentDisposition(contentDisposition)).toBe('bare-name.csv')
            })
        })

        describe('when the header is invalid or not provided', () => {
            it('returns "unknown"', () => {
                expect(HttpUtil.extractContentDisposition('')).toBe('unknown')
                expect(HttpUtil.extractContentDisposition('attachment')).toBe('unknown')
                expect(HttpUtil.extractContentDisposition('inline; foo=bar')).toBe('unknown')
            })
        })

        describe('when filename* decoding fails', () => {
            it('falls back to the quoted or bare value', () => {
                const badStar = `attachment; filename*=UTF-8''%E0%A4%ZZ; filename="safe-fallback.txt"`
                expect(HttpUtil.extractContentDisposition(badStar)).toBe('safe-fallback.txt')

                const badStarNoQuoted = `attachment; filename*=UTF-8''%E0%A4%ZZ; filename=bare-fallback.txt`
                expect(HttpUtil.extractContentDisposition(badStarNoQuoted)).toBe(
                    'bare-fallback.txt'
                )
            })
        })
    })
})
