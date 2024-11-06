import { Injectable } from '@nestjs/common'
import { CacheService, MethodLog } from 'common'

const makeCustomerKey = (showtimeId: string, customerId: string) =>
    `Customer:{${showtimeId}}:${customerId}`
const makeTicketKey = (showtimeId: string, ticketId: string) => `Ticket:{${showtimeId}}:${ticketId}`

@Injectable()
export class TicketHoldingService {
    constructor(private cacheService: CacheService) {}

    @MethodLog({ level: 'verbose' })
    async holdTickets(showtimeId: string, customerId: string, ticketIds: string[], ttlMs: number) {
        const ticketKeys = ticketIds.map((ticketId) => makeTicketKey(showtimeId, ticketId))
        const customerKeyStr = makeCustomerKey(showtimeId, customerId)
        const keys = [...ticketKeys, customerKeyStr]

        const script = `
            local customerId = ARGV[1]
            local ttlMs = tonumber(ARGV[2])
            local ticketIdsJson = ARGV[3]
            local prefix = ARGV[4]
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
            this.cacheService.prefix,
            showtimeId
        ])

        return result === 1
    }

    @MethodLog({ level: 'verbose' })
    async findTicketIds(showtimeId: string, customerId: string): Promise<string[]> {
        const tickets = await this.cacheService.get(makeCustomerKey(showtimeId, customerId))

        return tickets ? JSON.parse(tickets) : []
    }

    @MethodLog({ level: 'verbose' })
    async releaseTickets(showtimeId: string, customerId: string) {
        const tickets = await this.findTicketIds(showtimeId, customerId)

        await Promise.all(
            tickets.map((ticketId) => this.cacheService.delete(makeTicketKey(showtimeId, ticketId)))
        )

        await this.cacheService.delete(makeCustomerKey(showtimeId, customerId))

        return true
    }
}
