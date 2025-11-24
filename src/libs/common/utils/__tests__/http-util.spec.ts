import { HttpUtil } from 'common'

describe('HttpUtil', () => {
    describe('buildContentDisposition', () => {
        // 파일명이 ASCII인 경우
        describe('when the filename is ASCII', () => {
            // RFC5987 형식으로 반환한다
            it('returns RFC5987 content-disposition', () => {
                const filename = 'hello_world-1.0.txt'
                const cd = HttpUtil.buildContentDisposition(filename)

                expect(cd).toEqual(
                    `attachment; filename="hello_world-1.0.txt"; filename*=UTF-8''hello_world-1.0.txt`
                )
            })
        })

        // 공백이나 특수문자가 포함된 경우
        describe('when the filename has spaces or special chars', () => {
            // filename*에 +와 퍼센트 인코딩을 적용한다
            it('applies + and percent-encoding in filename*', () => {
                const filename = `report (final)'v1*.txt`
                const cd = HttpUtil.buildContentDisposition(filename)

                expect(cd).toEqual(
                    `attachment; filename="report (final)'v1-.txt"; filename*=UTF-8''report+%28final%29%27v1%2A.txt`
                )
            })
        })

        // 한글/유니코드 파일명인 경우
        describe('when the filename is Korean or Unicode', () => {
            // 원본을 filename*에 보존하고 ASCII 폴백은 "_"로 대체한다
            it('preserves filename* and replaces non-ASCII in fallback', () => {
                const filename = '한글 파일명(최종).pdf'
                const cd = HttpUtil.buildContentDisposition(filename)

                expect(cd).toEqual(
                    `attachment; filename="__ ___(__).pdf"; filename*=UTF-8''%ED%95%9C%EA%B8%80+%ED%8C%8C%EC%9D%BC%EB%AA%85%28%EC%B5%9C%EC%A2%85%29.pdf`
                )
            })
        })

        // 금지문자가 포함된 경우
        describe('when the filename has forbidden characters', () => {
            // ASCII 폴백에서 "-"로 치환한다
            it('replaces forbidden characters with "-" in fallback', () => {
                const filename = 'bad:/\\?%*:|"<>name.txt'
                const cd = HttpUtil.buildContentDisposition(filename)

                expect(cd).toEqual(
                    `attachment; filename="bad-----------name.txt"; filename*=UTF-8''bad%3A%2F%5C%3F%25%2A%3A%7C%22%3C%3Ename.txt`
                )
            })
        })

        // 공백이 있는 ASCII 파일명인 경우
        describe('when the ASCII filename contains spaces', () => {
            // filename*에서 공백을 +로 표기한다
            it('uses + for spaces in filename*', () => {
                const filename = 'my file name.txt'
                const cd = HttpUtil.buildContentDisposition(filename)

                expect(cd).toEqual(
                    `attachment; filename="my file name.txt"; filename*=UTF-8''my+file+name.txt`
                )
            })
        })

        // 파일명이 비어 있는 경우
        describe('when the filename is empty', () => {
            // 폴백을 "file"로 설정한다
            it('defaults the fallback filename to "file"', () => {
                const filename = ''
                const cd = HttpUtil.buildContentDisposition(filename)

                expect(cd).toEqual(`attachment; filename="file"; filename*=UTF-8''`)
            })
        })
    })

    describe('extractContentDisposition', () => {
        // filename*가 없는 경우
        describe('when only a quoted filename exists', () => {
            // quoted 값을 추출한다
            it('extracts the quoted filename', () => {
                const cd = `attachment; filename="ascii-name.txt"`
                expect(HttpUtil.extractContentDisposition(cd)).toBe('ascii-name.txt')
            })
        })

        // bare filename만 있는 경우
        describe('when only a bare filename exists', () => {
            // bare 값을 추출한다
            it('extracts the bare filename', () => {
                const cd = `inline; filename=bare-name.csv`
                expect(HttpUtil.extractContentDisposition(cd)).toBe('bare-name.csv')
            })
        })

        // 헤더가 잘못되었거나 누락된 경우
        describe('when the header is invalid or missing', () => {
            // "unknown"을 반환한다
            it('returns "unknown"', () => {
                expect(HttpUtil.extractContentDisposition('')).toBe('unknown')
                expect(HttpUtil.extractContentDisposition('attachment')).toBe('unknown')
                expect(HttpUtil.extractContentDisposition('inline; foo=bar')).toBe('unknown')
            })
        })

        // filename* 디코딩이 실패한 경우
        describe('when filename* decoding fails', () => {
            // quoted 또는 bare 값으로 폴백한다
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
