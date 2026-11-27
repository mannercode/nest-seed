import type { NextRequest } from 'next/server'

function isBucketUrl(url: URL, endpoint: URL, bucket: string): boolean {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (url.protocol !== endpoint.protocol || url.username || url.password) return false
    const basePath = endpoint.pathname.replace(/\/$/, '')
    if (url.host !== endpoint.host && url.host !== `${bucket}.${endpoint.host}`) return false
    const bucketPath = url.host === endpoint.host ? `${basePath}/${bucket}` : basePath
    return url.pathname === bucketPath || url.pathname.startsWith(bucketPath + '/')
}

async function proxy(request: NextRequest): Promise<Response> {
    const endpoint = process.env.S3_ENDPOINT
    if (!endpoint) throw new Error('S3_ENDPOINT is required')
    const bucket = process.env.S3_BUCKET
    if (!bucket) throw new Error('S3_BUCKET is required')
    const target = request.nextUrl.searchParams.get('url')
    const url = target && URL.parse(target)
    if (!url || !isBucketUrl(url, new URL(endpoint), bucket))
        return new Response(null, { status: 400 })

    // S3는 호스트·경로·쿼리를 서명에 포함하므로 검증한 URL을 그대로 전달한다.
    const headers = new Headers()
    for (const name of ['content-type', 'content-length']) {
        const value = request.headers.get(name)
        if (value) headers.set(name, value)
    }
    const options: RequestInit & { duplex: 'half' } = {
        method: request.method,
        headers,
        body: request.body,
        signal: request.signal,
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
