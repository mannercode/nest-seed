import { sleep } from 'common'
import { withTestId } from 'testlib'
import type { Fixture } from './queue-group.fixture'

describe('NATS Queue Group', () => {
    let fix: Fixture
    let queueSpy: jest.SpyInstance
    let broadcastSpy: jest.SpyInstance

    beforeEach(async () => {
        const { createFixture, MessageController } = await import('./queue-group.fixture')

        queueSpy = jest.spyOn(MessageController.prototype, 'processQueueLogic')
        broadcastSpy = jest.spyOn(MessageController.prototype, 'processBroadcastLogic')

        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    // queue 그룹이 설정된 경우
    describe('when a queue group is set', () => {
        // 메시지가 한 인스턴스에만 전달된다
        it('delivers the message to one instance', async () => {
            const result = await fix.rpcClient.getJson(withTestId('queue'), {})

            expect(result).toEqual({ result: 'success' })
            expect(queueSpy).toHaveBeenCalledTimes(1)
        })
    })

    // queue 그룹이 없는 경우
    describe('when no queue group is set', () => {
        // 메시지가 모든 인스턴스에 전달된다
        it('delivers the message to all instances', async () => {
            const result = await fix.rpcClient.getJson(withTestId('broadcast'), {})
            await sleep(1000)

            expect(result).toEqual({ result: 'success' })
            expect(broadcastSpy).toHaveBeenCalledTimes(fix.numberOfInstance)
        })
    })
})
