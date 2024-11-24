import { TestingModule } from '@nestjs/testing'
import { EventModule, EventService } from 'common'
import { createTestingModule } from 'testlib'
import { AppEventListener, SampleEvent } from './event.service.fixture'

describe('EventService', () => {
    let module: TestingModule
    let eventListener: AppEventListener
    let eventService: EventService

    beforeEach(async () => {
        module = await createTestingModule({
            imports: [EventModule.forRoot({ wildcard: true, delimiter: '.' })],
            providers: [AppEventListener, EventService]
        })
        const app = module.createNestApplication()
        await app.init()

        eventListener = module.get(AppEventListener)
        eventService = module.get(EventService)
    })

    afterEach(async () => {
        await module.close()
        jest.restoreAllMocks()
    })

    it('emits and receives a specific event', async () => {
        const spy = jest.spyOn(eventListener, 'onSampleEvent')

        await eventService.emit(new SampleEvent('event'))

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ text: 'event' }))
    })

    it('emits and receives an event matching a wildcard pattern', async () => {
        const spy = jest.spyOn(eventListener, 'onWildEvent')

        await eventService.emit(new SampleEvent('event'))

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ text: 'event' }))
    })

    it('emits and receives any event', async () => {
        const spy = jest.spyOn(eventListener, 'onAnyEvent')

        await eventService.emit(new SampleEvent('event'))

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ text: 'event' }))
    })
})
