import { sleep } from 'common'
import { withTestId } from 'testlib'
import type { Fixture } from './queue-group.fixture'

describe('NATS Queue Group', () => {
    let fixture: Fixture
    let queueSpy: jest.SpyInstance
    let broadcastSpy: jest.SpyInstance

    beforeEach(async () => {
        const { createFixture, MessageController } = await import('./queue-group.fixture')

        queueSpy = jest.spyOn(MessageController.prototype, 'processQueueLogic')
        broadcastSpy = jest.spyOn(MessageController.prototype, 'processBroadcastLogic')

        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('when a queue group is set', () => {
        it('delivers the message to one instance', async () => {
            const result = await fixture.rpcClient.getJson(withTestId('queue'), {})

            expect(result).toEqual({ result: 'success' })
            expect(queueSpy).toHaveBeenCalledTimes(1)
        })
    })

    describe('when no queue group is set', () => {
        it('delivers the message to all instances', async () => {
            const result = await fixture.rpcClient.getJson(withTestId('broadcast'), {})
            await sleep(1000)

            expect(result).toEqual({ result: 'success' })
            expect(broadcastSpy).toHaveBeenCalledTimes(fixture.numberOfInstance)
        })
    })
})
