const API_BASE_URL = process.env.API_BASE_URL
if (!API_BASE_URL) {
    throw new Error(
        'API_BASE_URL is required (e.g. http://localhost:3000). Set it in apps/user-app/.env'
    )
}

/** @type {import('next').NextConfig} */
const nextConfig = {}

export default nextConfig
