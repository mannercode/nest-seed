import { z } from 'zod'

export const UserAuthPayloadSchema = z.object({
    // 롤링 교체 중 구 복제본이 발급한 토큰은 claim이 없다.
    // 누락은 0으로 보되, 계정 version이 증가한 뒤에는 동일하게 거부된다.
    authVersion: z.number().int().nullish(),
    sub: z.string(),
    email: z.email()
})

export type UserAuthPayload = z.infer<typeof UserAuthPayloadSchema>
