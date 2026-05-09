describe('HttpTestClient', () => {
    describe('JSON 응답 파싱', () => {
        it.todo('64-bit 정수를 string 으로 보존해 정밀도 손실을 막는다')
        it.todo('ISO 8601 timestamp 를 Date 객체로 되살린다')
    })

    describe('상태 코드 단언', () => {
        it.todo('.badRequest() 가 400 이 아닐 때 fail 한다')
        it.todo('.internalServerError() 가 500 이 아닐 때 fail 한다')
    })

    describe('multipart 업로드', () => {
        it.todo('.attachments() 와 .fields() 를 함께 쓰면 multipart/form-data 로 전송된다')
    })

    describe('fluent setter 동작', () => {
        it.todo('body() 를 두 번 호출하면 두 번째 값으로 override 된다')
    })
})
