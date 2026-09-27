import { HttpUtil } from '../index.js'

describe('HttpUtil', () => {
    describe('buildContentDisposition', () => {
        describe('파일명이 ASCII 문자로만 구성되어 있으면', () => {
            let filename: string
            beforeEach(() => {
                filename = 'hello_world-1.0.txt'
            })
            it('헤더를 만들면 파일명을 RFC 8187 형식으로 반환한다', () => {
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="hello_world-1.0.txt"; filename*=UTF-8''hello_world-1.0.txt`
                )
            })
        })

        describe('파일명에 특수 문자가 포함되어 있으면', () => {
            let filename: string
            beforeEach(() => {
                filename = `report (final)'v1*.txt`
            })
            it('헤더를 만들면 filename*에 퍼센트 인코딩을 적용한다', () => {
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="report (final)'v1-.txt"; filename*=UTF-8''report%20%28final%29%27v1%2A.txt`
                )
            })
        })

        describe('파일명에 비ASCII 문자가 포함되어 있으면', () => {
            let filename: string
            beforeEach(() => {
                filename = '한글 파일명(최종).pdf'
            })
            it('헤더를 만들면 대체 파일명의 비ASCII 문자를 밑줄로 바꾼다', () => {
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="__ ___(__).pdf"; filename*=UTF-8''%ED%95%9C%EA%B8%80%20%ED%8C%8C%EC%9D%BC%EB%AA%85%28%EC%B5%9C%EC%A2%85%29.pdf`
                )
            })
        })

        describe('파일명에 금지 문자가 포함되어 있으면', () => {
            let filename: string
            beforeEach(() => {
                filename = 'bad:/\\?%*:|"<>name.txt'
            })
            it('헤더를 만들면 대체 파일명의 금지 문자를 하이픈으로 바꾼다', () => {
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="bad-----------name.txt"; filename*=UTF-8''bad%3A%2F%5C%3F%25%2A%3A%7C%22%3C%3Ename.txt`
                )
            })
        })

        describe('파일명에 공백이 포함되어 있으면', () => {
            let filename: string
            beforeEach(() => {
                filename = 'my file name.txt'
            })
            it('헤더를 만들면 filename*의 공백을 %20으로 인코딩한다', () => {
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(
                    `attachment; filename="my file name.txt"; filename*=UTF-8''my%20file%20name.txt`
                )
            })
        })

        describe('파일명이 빈 문자열이면', () => {
            let filename: string
            beforeEach(() => {
                filename = ''
            })
            it('헤더를 만들면 대체 파일명으로 "file"을 쓴다', () => {
                const contentDisposition = HttpUtil.buildContentDisposition(filename)

                expect(contentDisposition).toEqual(`attachment; filename="file"; filename*=UTF-8''`)
            })
        })
    })
})
