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
})
