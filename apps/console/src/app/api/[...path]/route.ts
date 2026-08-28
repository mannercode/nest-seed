import { createBffProxy } from '@mannercode/frontend/bff'

const proxy = createBffProxy({
    accessCookie: 'nest-seed-admin-access',
    authPrefix: 'admins',
    refreshCookie: 'nest-seed-admin-refresh'
})

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const PUT = proxy
export const DELETE = proxy
