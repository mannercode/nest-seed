import path from 'path'
import { fileURLToPath } from 'url'

// 개발 환경에서는 console 이 /api/* 를 NestJS API 로 프록시 한다.
// API_BASE_URL 은 명시 필수 (apps/console/.env.local 에서 지정).
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
