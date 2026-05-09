import { TimeUtil } from '@mannercode/common'
import { CronExpression } from '@nestjs/schedule'

/**
 * 이 값은 거의 변경되지 않는다. 또한 극장이나 서비스 마다 달라질 가능성도 없다.
 * 그래서 환경설정으로 설정하게 하거나 외부에서 주입받는 것은 불필요하다.
 */
export const Rules = {
    Asset: {
        downloadExpiresInSec: 60 * 60,
        expiredUploadCleanupCron: CronExpression.EVERY_10_MINUTES,
        uploadExpiresInSec: 60 * 60
    },
    Auth: {
        // bcrypt salt rounds — 비용 계수. 10 은 OWASP 권장 기본값.
        bcryptSaltRounds: 10
    },
    Movie: {
        defaults: {
            director: '',
            durationInSeconds: -1,
            plot: '',
            rating: 'Unrated',
            releaseDate: new Date('0000-01-01'),
            title: ''
        }
    },
    Showtime: {
        // 상영 시간을 나누는 최소 단위 (분 단위)
        timeslotInMinutes: 10
    },
    Ticket: {
        // 티켓을 임시로 선점할 수 있는 시간
        holdDurationInMs: TimeUtil.toMs('10m'),

        // 한 번에 구매할 수 있는 최대 티켓 수
        maxTicketsPerPurchase: 10,

        // 티켓 구매 가능 시간 (상영 시작 전 몇 분까지 구매 가능한지)
        purchaseCutoffMinutes: 30
    }
} as const
