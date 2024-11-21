import { expect } from '@jest/globals'
import { WatchRecordDto, WatchRecordsService } from 'services/watch-records'
import { expectEqualUnsorted } from 'testlib'
import {
    closeFixture,
    createFixture,
    createWatchRecordDto,
    createWatchRecords,
    Fixture
} from './watch-records.fixture'
import { OrderDirection } from 'common'

describe('WatchRecords Module', () => {
    let isolated: Fixture
    let service: WatchRecordsService

    beforeEach(async () => {
        isolated = await createFixture()
        service = isolated.watchRecordsService
    })

    afterEach(async () => {
        await closeFixture(isolated)
    })

    describe('createWatchRecords', () => {
        it('관람 기록을 생성해야 한다', async () => {
            const { createDto, expectedDto } = createWatchRecordDto({
                customerId: '000000000000000000000001',
                movieId: '000000000000000000000002',
                purchaseId: '000000000000000000000003',
                watchDate: new Date('2020-12-12T09:30')
            })

            const watchRecord = await service.createWatchRecords(createDto)
            expect(watchRecord).toEqual(expectedDto)
        })
    })

    describe('findWatchRecords', () => {
        let records: WatchRecordDto[]

        beforeEach(async () => {
            records = await createWatchRecords(service)
        })

        it('기본 페이지네이션 설정으로 관람 기록을 가져와야 한다', async () => {
            const customerId = records[0].customerId
            const { items, ...paginated } = await service.findWatchRecords({
                customerId,
                orderby: { name: 'watchDate', direction: OrderDirection.desc }
            })

            expect(paginated).toEqual({
                skip: 0,
                take: expect.any(Number),
                total: records.length
            })
            expectEqualUnsorted(items, records)
        })
    })
})
