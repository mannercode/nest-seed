import { HttpUtil } from 'common'

describe('HttpUtil', () => {
    describe('buildContentDisposition', () => {
        // ASCII 파일명: RFC5987 형식으로 생성되고 그대로 복원 가능한가
        test('ASCII filename: should generate RFC5987 format and be reversible', () => {
            const filename = 'hello_world-1.0.txt'
            const cd = HttpUtil.buildContentDisposition(filename)

            expect(cd).toEqual(
                `attachment; filename="hello_world-1.0.txt"; filename*=UTF-8''hello_world-1.0.txt`
            )
        })

        // 공백/특수문자 포함 파일명: filename*에서 +/퍼센트 인코딩이 적용되는가
        test('Filename with spaces/special chars: should apply + and percent-encoding in filename*', () => {
            const filename = `report (final)'v1*.txt`
            const cd = HttpUtil.buildContentDisposition(filename)

            expect(cd).toEqual(
                `attachment; filename="report (final)'v1-.txt"; filename*=UTF-8''report+%28final%29%27v1%2A.txt`
            )
        })

        // 한글/유니코드 파일명: filename*로 원본 복원, ASCII 폴백은 비ASCII를 "_"로 대체
        test('Korean/Unicode filename: should preserve original in filename* and replace non-ASCII with "_" in fallback', () => {
            const filename = '한글 파일명(최종).pdf'
            const cd = HttpUtil.buildContentDisposition(filename)

            expect(cd).toEqual(
                `attachment; filename="__ ___(__).pdf"; filename*=UTF-8''%ED%95%9C%EA%B8%80+%ED%8C%8C%EC%9D%BC%EB%AA%85%28%EC%B5%9C%EC%A2%85%29.pdf`
            )
        })

        // 금지문자 포함: ASCII 폴백에서 금지문자가 "-"로 치환되는가
        test('Filename with forbidden characters: should replace them with "-" in ASCII fallback', () => {
            const filename = 'bad:/\\?%*:|"<>name.txt'
            const cd = HttpUtil.buildContentDisposition(filename)

            expect(cd).toEqual(
                `attachment; filename="bad-----------name.txt"; filename*=UTF-8''bad%3A%2F%5C%3F%25%2A%3A%7C%22%3C%3Ename.txt`
            )
        })

        // 공백이 있는 ASCII 파일명: filename*에서 공백이 + 로 표시되는가
        test('ASCII filename with spaces: should show spaces as + in filename*', () => {
            const filename = 'my file name.txt'
            const cd = HttpUtil.buildContentDisposition(filename)

            expect(cd).toEqual(
                `attachment; filename="my file name.txt"; filename*=UTF-8''my+file+name.txt`
            )
        })

        // 빈 파일명: 폴백이 비어 있을 수 있으므로 전체 포맷만 보증(추가 정책 검토 필요)
        test('Empty filename: should default to "file" in fallback', () => {
            const filename = ''
            const cd = HttpUtil.buildContentDisposition(filename)

            expect(cd).toEqual(`attachment; filename="file"; filename*=UTF-8''`)
        })
    })

    describe('extractContentDisposition', () => {
        // filename*가 없고 filename="..."만 있을 때: quoted 값 사용
        test('Only quoted filename: should extract quoted value', () => {
            const cd = `attachment; filename="ascii-name.txt"`
            expect(HttpUtil.extractContentDisposition(cd)).toBe('ascii-name.txt')
        })

        // bare filename만 있을 때: bare 값 사용
        test('Only bare filename: should extract bare value', () => {
            const cd = `inline; filename=bare-name.csv`
            expect(HttpUtil.extractContentDisposition(cd)).toBe('bare-name.csv')
        })

        // 잘못된/누락된 헤더 형식: unknown 반환
        test('Invalid or missing header: should return "unknown"', () => {
            expect(HttpUtil.extractContentDisposition('')).toBe('unknown')
            expect(HttpUtil.extractContentDisposition('attachment')).toBe('unknown')
            expect(HttpUtil.extractContentDisposition('inline; foo=bar')).toBe('unknown')
        })

        // filename*가 decode 실패 시(깨진 인코딩): quoted/bare로 폴백
        test('Broken filename*: should fallback to quoted or bare value', () => {
            const badStar = `attachment; filename*=UTF-8''%E0%A4%ZZ; filename="safe-fallback.txt"`
            expect(HttpUtil.extractContentDisposition(badStar)).toBe('safe-fallback.txt')

            const badStarNoQuoted = `attachment; filename*=UTF-8''%E0%A4%ZZ; filename=bare-fallback.txt`
            expect(HttpUtil.extractContentDisposition(badStarNoQuoted)).toBe('bare-fallback.txt')
        })
    })
})
