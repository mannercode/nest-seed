import { CronExpression } from '@nestjs/schedule'

export const InfraRules = {
    Asset: {
        downloadExpiresInSec: 60 * 60,
        expiredUploadCleanupCron: CronExpression.EVERY_10_MINUTES,
        uploadExpiresInSec: 60 * 60
    }
} as const
