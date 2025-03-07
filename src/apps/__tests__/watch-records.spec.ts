import { expect } from '@jest/globals'
import { OrderDirection } from 'common'
import { WatchRecordDto, WatchRecordsService } from 'cores'
import { expectEqualUnsorted, testObjectId } from 'testlib'
import {
    closeFixture,
    createWatchRecordDto,
    createWatchRecords,
    Fixture
} from './watch-records.fixture'

describe('WatchRecords Module', () => {
    let fixture: Fixture
    let service: WatchRecordsService

    beforeEach(async () => {
        const { createFixture } = await import('./watch-records.fixture')

        fixture = await createFixture()
        service = fixture.watchRecordsService
    })

    afterEach(async () => {
        await closeFixture(fixture)
    })

    describe('createWatchRecords', () => {
        it('관람 기록을 생성해야 한다', async () => {
            const { createDto, expectedDto } = createWatchRecordDto()

            const watchRecord = await service.createWatchRecord(createDto)
            expect(watchRecord).toEqual(expectedDto)
        })
    })

    describe('findWatchRecords', () => {
        let records: WatchRecordDto[]
        const customerId = testObjectId('A1')

        beforeEach(async () => {
            records = await createWatchRecords(service, { customerId })
        })

        it('기본 페이지네이션 설정으로 관람 기록을 가져와야 한다', async () => {
            const { items, ...paginated } = await service.findWatchRecords({
                customerId,
                take: 100,
                orderby: { name: 'watchDate', direction: OrderDirection.desc }
            })

            expect(paginated).toEqual({
                skip: 0,
                take: 100,
                total: records.length
            })
            expectEqualUnsorted(items, records)
        })
    })
})
