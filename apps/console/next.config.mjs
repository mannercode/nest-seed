import path from 'path'
import { fileURLToPath } from 'url'

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
    transpilePackages: ['@mannercode/frontend']
}

export default nextConfig
