import { CloseFixture, MicroserviceTestClient, withTestId } from 'testlib'
import { sleep } from '../../utils'

describe('ClientProxyService', () => {
    let closeFixture: CloseFixture
    let client: MicroserviceTestClient
    let queueSpy: jest.SpyInstance
    let broadcastSpy: jest.SpyInstance
    let numberOfInstance: number

    beforeEach(async () => {
        const {
            createFixture,
            MessageController,
            numberOfInstance: instanseCount
        } = await import('./queue-group.fixture')

        queueSpy = jest.spyOn(MessageController.prototype, 'processQueueLogic')
        broadcastSpy = jest.spyOn(MessageController.prototype, 'processBroadcastLogic')
        numberOfInstance = instanseCount

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        client = fixture.client
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('queue 그룹을 설정하면 한 인스턴스에만 전달되어야 한다', async () => {
        const result = await client.send(withTestId('subject.queue'), {})
        expect(result).toEqual({ result: 'success' })
        expect(queueSpy).toHaveBeenCalledTimes(1)
    })

    it('queue 그룹을 설정하지 않으면 전체 인스턴스에 전달되어야 한다', async () => {
        const result = await client.send(withTestId('subject.broadcast'), {})
        await sleep(500)
        expect(result).toEqual({ result: 'success' })
        expect(broadcastSpy).toHaveBeenCalledTimes(numberOfInstance)
    })
})
