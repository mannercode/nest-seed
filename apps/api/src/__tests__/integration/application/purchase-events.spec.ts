import type { NatsConnection } from '@mannercode/common'
import type { PurchaseEvents } from 'application'
import type { AppTestContext } from '../helpers'

const NOTIFICATION_LOG = 'would send purchase confirmation'
const PURCHASED_LOG = 'purchase observed'

const countLogCalls = (logSpy: jest.SpyInstance, message: string) =>
    logSpy.mock.calls.filter(([msg]) => msg === message).length

describe('PurchaseEvents', () => {
    let fix: AppTestContext
    let events: PurchaseEvents
    let logSpy: jest.SpyInstance

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { PurchaseEvents } = await import('application')
        fix = await createAppTestContext()
        events = fix.module.get(PurchaseEvents)
        // `resetModules: true` 환경에서는 감시 대상 Logger가 구독자 Logger와 같은 실행 영역에 있어야 한다.
        // 그래서 같은 모듈 그래프에서 동적으로 가져온다.
        const { Logger } = await import('@nestjs/common')
        logSpy = jest.spyOn(Logger.prototype, 'log')
    })

    afterEach(() => fix.teardown())

    it('ticketPurchased 이벤트는 알림 구독자와 로그 구독자 모두에 전달한다', async () => {
        const { waitFor } = await import('./purchase-events.utils')
        const userId = 'user-1'
        const ticketIds = ['t1', 't2']

        await events.emitTicketPurchased({ userId, ticketIds })

        await waitFor(
            () =>
                countLogCalls(logSpy, NOTIFICATION_LOG) > 0 &&
                countLogCalls(logSpy, PURCHASED_LOG) > 0
        )

        expect(countLogCalls(logSpy, NOTIFICATION_LOG)).toBe(1)
        expect(countLogCalls(logSpy, PURCHASED_LOG)).toBe(1)
    })

    it('알림 구독은 큐 그룹에 참여해 같은 그룹의 다른 멤버가 있어도 전체에서 한 번만 처리한다', async () => {
        const { waitFor } = await import('./purchase-events.utils')
        const { NatsPubSubService, getNatsConnectionToken } = await import('@mannercode/common')
        const { NATS_CONNECTION_NAME } = await import('config')

        const connection = fix.module.get<NatsConnection>(
            getNatsConnectionToken(NATS_CONNECTION_NAME)
        )
        // 앱 서비스에 subscribe하면 기존 구독에 핸들러만 추가되므로, 별도 인스턴스로 두 번째 그룹 멤버를 만든다.
        const secondMember = new NatsPubSubService(connection)
        let probeCount = 0
        // 큐 그룹명은 PurchaseNotificationService가 참여하는 그룹과 같아야 한다.
        await secondMember.subscribe(events.subjects.purchased, () => probeCount++, {
            queue: 'purchase-notification'
        })

        await events.emitTicketPurchased({ userId: 'user-1', ticketIds: ['t1'] })

        // 브로드캐스트 구독자 수신은 메시지가 서버를 왕복했다는 신호다.
        await waitFor(
            () =>
                countLogCalls(logSpy, PURCHASED_LOG) > 0 &&
                probeCount + countLogCalls(logSpy, NOTIFICATION_LOG) >= 1
        )
        // 중복 전달이 있었다면 도달했을 시간만큼 잠깐 기다린다.
        await new Promise((r) => setTimeout(r, 50))

        await secondMember.onModuleDestroy()

        expect(probeCount + countLogCalls(logSpy, NOTIFICATION_LOG)).toBe(1)
    })
})
