// express 서버 + superagent 클라이언트로 GET 호출 N 번. 사용자 코드의
// HttpTestClient 가 superagent 기반이므로 같은 라이브러리로 누수 검증.
const express = require('express')
const superagent = require('superagent')
const { probe } = require('./_probe')

const N = parseInt(process.env.LEAK_N ?? '100', 10)
const PAYLOAD = parseInt(process.env.LEAK_PAYLOAD_KB ?? '1', 10)

test(`superagent GET × ${N} (payload ${PAYLOAD}KB)`, async () => {
    const body = { data: 'x'.repeat(PAYLOAD * 1024) }
    const app = express()
    app.get('/h', (_req, res) => res.json(body))
    const server = app.listen(0)
    const port = server.address().port
    const url = `http://127.0.0.1:${port}/h`

    probe('http baseline')
    for (let i = 1; i <= N; i++) {
        await superagent.get(url)
        if (i === 1 || i % 20 === 0) probe(`http iter-${i}`)
    }
    server.close()
})
