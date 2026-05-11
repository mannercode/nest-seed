import path from 'path'
import { fileURLToPath } from 'url'

// 개발 환경에서는 console이 `/api/*` 요청을 NestJS API로 프록시 합니다.
// 대상 주소는 `API_BASE_URL`이 가리킵니다. 값은 `apps/console/.env.local`
// 에 적어 두어야 합니다.
const API_BASE_URL = process.env.API_BASE_URL
if (!API_BASE_URL) {
    throw new Error(
        'API_BASE_URL is required (e.g. http://localhost:3000). Set it in apps/console/.env.local'
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
