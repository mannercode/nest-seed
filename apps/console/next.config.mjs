import path from 'path'
import { fileURLToPath } from 'url'

// 개발 환경에서는 콘솔이 `/api/*` 요청을 NestJS API로 프록시한다.
// 프록시 대상 주소는 `API_BASE_URL`에 둔다. 값은 `apps/console/.env`에 적어 둔다.
const API_BASE_URL = process.env.API_BASE_URL
if (!API_BASE_URL) {
    throw new Error(
        'API_BASE_URL is required (e.g. http://localhost:3000). Set it in apps/console/.env'
    )
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    outputFileTracingRoot: path.join(__dirname, '../..'),
    async rewrites() {
        return [{ source: '/api/:path*', destination: `${API_BASE_URL}/:path*` }]
    }
}

export default nextConfig
