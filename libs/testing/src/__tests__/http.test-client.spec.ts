describe('HttpTestClient', () => {
    describe('JSON 응답 파싱', () => {
        it.todo('64비트 정수를 string으로 보존해 정밀도 손실을 막는다')
        it.todo('ISO 8601 형식의 timestamp를 Date 객체로 되살린다')
    })

    describe('상태 코드 단언', () => {
        it.todo('.badRequest()는 400이 아니면 실패한다')
        it.todo('.internalServerError()는 500이 아니면 실패한다')
    })

    describe('multipart 업로드', () => {
        it.todo('.attachments()와 .fields()를 함께 쓰면 multipart/form-data로 전송된다')
    })

    describe('체이닝 setter', () => {
        it.todo('body()를 두 번 호출하면 두 번째 값으로 덮어쓴다')
    })
})
