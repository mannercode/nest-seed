import { HttpUtil } from '../http'

describe('HttpUtil', () => {
    describe('buildContentDisposition', () => {
        it('ASCII 파일명은 RFC 5987 형식 그대로 반환한다', () => {
            const filename = 'hello_world-1.0.txt'
            const contentDisposition = HttpUtil.buildContentDisposition(filename)

            expect(contentDisposition).toEqual(
                `attachment; filename="hello_world-1.0.txt"; filename*=UTF-8''hello_world-1.0.txt`
            )
        })

        it('특수 문자가 포함된 파일명은 filename*에 퍼센트 인코딩을 적용한다', () => {
            const filename = `report (final)'v1*.txt`
            const contentDisposition = HttpUtil.buildContentDisposition(filename)

            expect(contentDisposition).toEqual(
                `attachment; filename="report (final)'v1-.txt"; filename*=UTF-8''report+%28final%29%27v1%2A.txt`
            )
        })

        it('유니코드 파일명은 대체 파일명에서 비ASCII를 _로 바꾼다', () => {
            const filename = '한글 파일명(최종).pdf'
            const contentDisposition = HttpUtil.buildContentDisposition(filename)

            expect(contentDisposition).toEqual(
                `attachment; filename="__ ___(__).pdf"; filename*=UTF-8''%ED%95%9C%EA%B8%80+%ED%8C%8C%EC%9D%BC%EB%AA%85%28%EC%B5%9C%EC%A2%85%29.pdf`
            )
        })

        it('금지된 문자는 대체 파일명에서 -로 바꾼다', () => {
            const filename = 'bad:/\\?%*:|"<>name.txt'
            const contentDisposition = HttpUtil.buildContentDisposition(filename)

            expect(contentDisposition).toEqual(
                `attachment; filename="bad-----------name.txt"; filename*=UTF-8''bad%3A%2F%5C%3F%25%2A%3A%7C%22%3C%3Ename.txt`
            )
        })

        it('공백은 filename*에서 +로 인코딩한다', () => {
            const filename = 'my file name.txt'
            const contentDisposition = HttpUtil.buildContentDisposition(filename)

            expect(contentDisposition).toEqual(
                `attachment; filename="my file name.txt"; filename*=UTF-8''my+file+name.txt`
            )
        })

        it('빈 파일명이면 대체 파일명을 "file"로 한다', () => {
            const filename = ''
            const contentDisposition = HttpUtil.buildContentDisposition(filename)

            expect(contentDisposition).toEqual(`attachment; filename="file"; filename*=UTF-8''`)
        })
    })

    describe('extractContentDisposition', () => {
        it('따옴표로 감싼 filename을 추출한다', () => {
            const contentDisposition = `attachment; filename="ascii-name.txt"`
            expect(HttpUtil.extractContentDisposition(contentDisposition)).toBe('ascii-name.txt')
        })

        it('따옴표 없는 filename도 추출한다', () => {
            const contentDisposition = `inline; filename=bare-name.csv`
            expect(HttpUtil.extractContentDisposition(contentDisposition)).toBe('bare-name.csv')
        })

        it('유효하지 않거나 비어있는 헤더에서는 "unknown"을 반환한다', () => {
            expect(HttpUtil.extractContentDisposition('')).toBe('unknown')
            expect(HttpUtil.extractContentDisposition('attachment')).toBe('unknown')
            expect(HttpUtil.extractContentDisposition('inline; foo=bar')).toBe('unknown')
            expect(HttpUtil.extractContentDisposition('attachment; noequals')).toBe('unknown')
        })

        it("filename*에 ''(인코딩 마커)가 없으면 따옴표 filename으로 대체한다", () => {
            const cd = `attachment; filename*=noencoding; filename="fallback.txt"`
            expect(HttpUtil.extractContentDisposition(cd)).toBe('fallback.txt')
        })

        it('filename* 디코딩이 실패하면 따옴표 또는 bare filename으로 대체한다', () => {
            const badStar = `attachment; filename*=UTF-8''%E0%A4%ZZ; filename="safe-fallback.txt"`
            expect(HttpUtil.extractContentDisposition(badStar)).toBe('safe-fallback.txt')

            const badStarNoQuoted = `attachment; filename*=UTF-8''%E0%A4%ZZ; filename=bare-fallback.txt`
            expect(HttpUtil.extractContentDisposition(badStarNoQuoted)).toBe('bare-fallback.txt')
        })

        it('filename* 값이 빈 문자열이면 따옴표 filename으로 대체한다', () => {
            const cd = `attachment; filename*=; filename="fallback.txt"`
            expect(HttpUtil.extractContentDisposition(cd)).toBe('fallback.txt')
        })
    })
})
