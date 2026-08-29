import { z } from 'zod'

export const AdminAuthPayloadSchema = z.object({
    // 구 복제본이 발급한 claim 없는 토큰은 version 0으로만 호환한다.
    authVersion: z.number().int().nullish(),
    sub: z.string(),
    email: z.email()
})

export type AdminAuthPayload = z.infer<typeof AdminAuthPayloadSchema>
