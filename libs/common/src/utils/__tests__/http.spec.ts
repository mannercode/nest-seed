import { HttpUtil } from '../http'

describe('HttpUtil', () => {
    describe('buildContentDisposition', () => {
        describe('파일명이 ASCII일 때', () => {
            it('RFC5987 content-disposition을 반환한다', () => {
                const filename = 'hello_world-1.0.txt'
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="hello_world-1.0.txt"; filename*=UTF-8''hello_world-1.0.txt`
                )
            })
        })

        describe('파일명에 공백 또는 특수 문자가 있을 때', () => {
            it('filename*에 +와 퍼센트 인코딩을 적용한다', () => {
                const filename = `report (final)'v1*.txt`
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="report (final)'v1-.txt"; filename*=UTF-8''report+%28final%29%27v1%2A.txt`
                )
            })
        })

        describe('파일명이 유니코드일 때', () => {
            it('filename*는 유지하고 fallback에서는 비ASCII를 대체한다', () => {
                const filename = '한글 파일명(최종).pdf'
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="__ ___(__).pdf"; filename*=UTF-8''%ED%95%9C%EA%B8%80+%ED%8C%8C%EC%9D%BC%EB%AA%85%28%EC%B5%9C%EC%A2%85%29.pdf`
                )
            })
        })

        describe('파일명에 금지된 문자가 있을 때', () => {
            it('fallback에서 금지 문자를 "-"로 바꾼다', () => {
                const filename = 'bad:/\\?%*:|"<>name.txt'
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="bad-----------name.txt"; filename*=UTF-8''bad%3A%2F%5C%3F%25%2A%3A%7C%22%3C%3Ename.txt`
                )
            })
        })

        describe('파일명이 공백을 포함한 ASCII일 때', () => {
            it('filename*에서 공백을 +로 사용한다', () => {
                const filename = 'my file name.txt'
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="my file name.txt"; filename*=UTF-8''my+file+name.txt`
                )
            })
        })

        describe('파일명이 비어 있을 때', () => {
            it('fallback 파일명을 "file"로 기본 설정한다', () => {
                const filename = ''
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(`attachment; filename="file"; filename*=UTF-8''`)
            })
        })
    })

    describe('extractContentDisposition', () => {
        describe('따옴표로 감싼 파일명만 있을 때', () => {
            it('따옴표 파일명을 추출한다', () => {
                const contentDisposition = `attachment; filename="ascii-name.txt"`
                expect(HttpUtil.extractContentDisposition(contentDisposition)).toBe(
                    'ascii-name.txt'
                )
            })
        })

        describe('따옴표 없는 파일명만 있을 때', () => {
            it('따옴표 없는 파일명을 추출한다', () => {
                const contentDisposition = `inline; filename=bare-name.csv`
                expect(HttpUtil.extractContentDisposition(contentDisposition)).toBe('bare-name.csv')
            })
        })

        describe('헤더가 유효하지 않거나 제공되지 않을 때', () => {
            it('"unknown"을 반환한다', () => {
                expect(HttpUtil.extractContentDisposition('')).toBe('unknown')
                expect(HttpUtil.extractContentDisposition('attachment')).toBe('unknown')
                expect(HttpUtil.extractContentDisposition('inline; foo=bar')).toBe('unknown')
                expect(HttpUtil.extractContentDisposition('attachment; noequals')).toBe('unknown')
            })
        })

        describe("filename*에 ''가 없을 때", () => {
            it('fallback으로 filename을 사용한다', () => {
                const cd = `attachment; filename*=noencoding; filename="fallback.txt"`
                expect(HttpUtil.extractContentDisposition(cd)).toBe('fallback.txt')
            })
        })

        describe('filename* 디코딩이 실패할 때', () => {
            it('따옴표 또는 일반 값을 fallback으로 사용한다', () => {
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
