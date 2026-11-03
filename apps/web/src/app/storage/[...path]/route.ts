import type { NextRequest } from 'next/server'

type RouteContext = { params: Promise<{ path: string[] }> }

// 브라우저가 접근할 수 없는 Docker S3 주소를 같은 origin으로 연결한다.
// 업로드 조건과 다운로드 권한은 API가 발급한 S3 서명으로 검사된다.
async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
    const endpoint = process.env.S3_ENDPOINT
    if (!endpoint) throw new Error('S3_ENDPOINT is required')
    const { path } = await context.params
    const url = new URL(endpoint)
    url.pathname = '/' + path.map(encodeURIComponent).join('/')
    url.search = request.nextUrl.search
    const headers = new Headers()
    for (const name of ['content-type', 'content-length']) {
        const value = request.headers.get(name)
        if (value) headers.set(name, value)
    }
    const options: RequestInit & { duplex: 'half' } = {
        method: request.method,
        headers,
        body: request.body,
        duplex: 'half',
        cache: 'no-store',
        redirect: 'manual'
    }
    const upstream = await fetch(url, options)
    const responseHeaders = new Headers({ 'Cache-Control': 'private, no-store' })
    for (const name of ['content-type', 'content-length']) {
        const value = upstream.headers.get(name)
        if (value) responseHeaders.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
}

export { proxy as GET, proxy as POST }
