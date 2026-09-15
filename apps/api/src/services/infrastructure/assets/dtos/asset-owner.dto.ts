import { z } from 'zod'

export const AssetOwnerSchema = z.strictObject({ entityId: z.string(), service: z.string() })

export type AssetOwnerDto = z.infer<typeof AssetOwnerSchema>
