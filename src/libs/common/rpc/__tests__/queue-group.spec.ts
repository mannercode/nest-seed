import { sleep } from 'common'
import { withTestId } from 'testlib'
import type { QueueGroupFixture } from './queue-group.fixture'

describe('NATS Queue Group', () => {
    let fix: QueueGroupFixture
    let queueSpy: jest.SpyInstance
    let broadcastSpy: jest.SpyInstance

    beforeEach(async () => {
        const { createQueueGroupFixture, MessageController } = await import('./queue-group.fixture')

        queueSpy = jest.spyOn(MessageController.prototype, 'processQueueLogic')
        broadcastSpy = jest.spyOn(MessageController.prototype, 'processBroadcastLogic')

        fix = await createQueueGroupFixture()
    })
    afterEach(() => fix.teardown())

    // 큐 그룹이 설정되었을 때
    describe('when a queue group is set', () => {
        // 메시지를 한 인스턴스에 전달한다
        it('delivers the message to one instance', async () => {
            const result = await fix.rpcClient.request(withTestId('queue'), {})

            expect(result).toEqual({ result: 'success' })
            expect(queueSpy).toHaveBeenCalledTimes(1)
        })
    })

    // 큐 그룹이 설정되지 않았을 때
    describe('when no queue group is set', () => {
        // 메시지를 모든 인스턴스에 전달한다
        it('delivers the message to all instances', async () => {
            const result = await fix.rpcClient.request(withTestId('broadcast'), {})
            await sleep(1000)

            expect(result).toEqual({ result: 'success' })
            expect(broadcastSpy).toHaveBeenCalledTimes(fix.instanceCount)
        })
    })
})
