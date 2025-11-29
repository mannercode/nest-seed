import { Time } from 'common'

/**
 * This value rarely changes. Moreover, it is unlikely to vary depending on the theater or service.
 * Therefore, it is unnecessary to set it through configuration or to inject it from an external source.
 *
 * 이 값은 거의 변경되지 않는다. 또한 극장이나 서비스 마다 달라질 가능성도 없다.
 * 그래서 환경설정으로 설정하게 하거나 외부에서 주입받는 것은 불필요하다.
 */
export const Rules = {
    Ticket: {
        // Minutes before showtime when the purchase window closes
        // 티켓 구매 가능 시간 (상영 시작 전 몇 분까지 구매 가능한지)
        purchaseWindowCloseOffsetMinutes: 30,

        // Maximum number of tickets that can be purchased at once
        // 한 번에 구매할 수 있는 최대 티켓 수
        maxTicketsPerPurchase: 10,

        // Time duration a ticket can be temporarily held (reserved)
        // 티켓을 임시로 선점할 수 있는 시간
        holdDurationInMs: Time.toMs('10m')
    },
    Showtime: {
        // The minimum unit of time used to divide showtimes (in minutes)
        // 상영 시간을 나누는 최소 단위 (분 단위)
        timeslotInMinutes: 10
    },
    Movie: {
        // Minutes until a movie draft automatically expires
        // 영화 드래프트가 자동으로 만료되는 시간
        draftExpiresInMinutes: 60
    },
    Asset: { uploadExpiresInSec: 60 * 60, downloadExpiresInSec: 60 * 60 }
}
