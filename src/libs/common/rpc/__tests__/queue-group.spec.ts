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

    afterEach(async () => {
        await fix?.teardown()
    })

    it('delivers the message to one instance when a queue group is set', async () => {
        const result = await fix.rpcClient.getJson(withTestId('queue'), {})

        expect(result).toEqual({ result: 'success' })
        expect(queueSpy).toHaveBeenCalledTimes(1)
    })

    it('delivers the message to all instances when no queue group is set', async () => {
        const result = await fix.rpcClient.getJson(withTestId('broadcast'), {})
        await sleep(1000)

        expect(result).toEqual({ result: 'success' })
        expect(broadcastSpy).toHaveBeenCalledTimes(fix.numberOfInstance)
    })
})
