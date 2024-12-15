import { Injectable } from '@nestjs/common'
import { CacheService, InjectCache, MethodLog } from 'common'

const getCustomerKey = (showtimeId: string, customerId: string) =>
    `Customer:{${showtimeId}}:${customerId}`
const getTicketKey = (showtimeId: string, ticketId: string) => `Ticket:{${showtimeId}}:${ticketId}`

@Injectable()
export class TicketHoldingService {
    constructor(@InjectCache('ticket-holding') private cacheService: CacheService) {}

    @MethodLog({ level: 'verbose' })
    async holdTickets(args: {
        customerId: string
        showtimeId: string
        ticketIds: string[]
        ttlMs: number
    }) {
        const { customerId, showtimeId, ticketIds, ttlMs } = args

        const ticketKeys = ticketIds.map((ticketId) => getTicketKey(showtimeId, ticketId))
        const customerKeyStr = getCustomerKey(showtimeId, customerId)
        const keys = [...ticketKeys, customerKeyStr]

        const script = `
            local prefix = ARGV[1]
            local customerId = ARGV[2]
            local ttlMs = tonumber(ARGV[3])
            local ticketIdsJson = ARGV[4]
            local showtimeId = ARGV[5]

            -- 티켓이 이미 다른 고객에 의해 선점되었는지 확인
            for i = 1, #KEYS - 1 do
                local key = KEYS[i]
                local ownerId = redis.call('GET', key)
                if ownerId and ownerId ~= customerId then
                    return 0 -- 티켓 선점 실패
                end
            end

            -- 고객 키 (KEYS 배열의 마지막 요소)
            local customerKey = KEYS[#KEYS]

            -- 이전에 고객이 선점한 티켓 목록 가져오기
            local previousTicketIdsJson = redis.call('GET', customerKey)
            if previousTicketIdsJson then
                local previousTicketIds = cjson.decode(previousTicketIdsJson)
                for _, ticketId in ipairs(previousTicketIds) do
                    local ticketKey = prefix .. ':Ticket:{' .. showtimeId .. '}:' .. ticketId
                    redis.call('DEL', ticketKey)
                end
            end

            -- 모든 티켓을 현재 고객으로 설정
            for i = 1, #KEYS - 1 do
                local key = KEYS[i]
                redis.call('SET', key, customerId, 'PX', ttlMs)
            end

            -- 고객에 대한 티켓 목록 저장
            redis.call('SET', customerKey, ticketIdsJson, 'PX', ttlMs)

            return 1 -- 티켓 선점 성공
        `
        const result = await this.cacheService.executeScript(script, keys, [
            customerId,
            ttlMs.toString(),
            JSON.stringify(ticketIds),
            showtimeId
        ])

        return result === 1
    }

    @MethodLog({ level: 'verbose' })
    async findHeldTicketIds(showtimeId: string, customerId: string): Promise<string[]> {
        const tickets = await this.cacheService.get(getCustomerKey(showtimeId, customerId))

        return tickets ? JSON.parse(tickets) : []
    }

    @MethodLog({ level: 'verbose' })
    async releaseTickets(showtimeId: string, customerId: string) {
        const tickets = await this.findHeldTicketIds(showtimeId, customerId)

        await Promise.all(
            tickets.map((ticketId) => this.cacheService.delete(getTicketKey(showtimeId, ticketId)))
        )

        await this.cacheService.delete(getCustomerKey(showtimeId, customerId))

        return true
    }
}
