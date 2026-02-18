import { Injectable } from '@nestjs/common'
import { CacheService } from 'common'
import { InjectCache } from 'common'
import { Rules } from 'shared'
import { HoldTicketsDto } from './dtos'

const getCustomerKey = (showtimeId: string, customerId: string) =>
    `Customer:{${showtimeId}}:${customerId}`
const getTicketKey = (showtimeId: string, ticketId: string) => `Ticket:{${showtimeId}}:${ticketId}`

const HOLD_TICKETS_SCRIPT = `
    local prefix = ARGV[1]
    local customerId = ARGV[2]
    local ttlMs = tonumber(ARGV[3])
    local ticketIdsJson = ARGV[4]
    local showtimeId = ARGV[5]

    -- Check if the ticket is already held by another customer
    -- 티켓이 이미 다른 고객에 의해 선점되었는지 확인
    for i = 1, #KEYS - 1 do
        local key = KEYS[i]
        local ownerId = redis.call('GET', key)
        if ownerId and ownerId ~= customerId then
            -- Ticket holding failed
            -- 티켓 선점 실패
            return 0
        end
    end

    -- Customer key (last element in KEYS array)
    -- 고객 키 (KEYS 배열의 마지막 요소)
    local customerKey = KEYS[#KEYS]

    -- Get the list of tickets previously held by the customer
    -- 이전에 고객이 선점한 티켓 목록 가져오기
    local previousTicketIdsJson = redis.call('GET', customerKey)
    if previousTicketIdsJson then
        local previousTicketIds = cjson.decode(previousTicketIdsJson)
        for _, ticketId in ipairs(previousTicketIds) do
            local ticketKey = prefix .. ':Ticket:{' .. showtimeId .. '}:' .. ticketId
            redis.call('DEL', ticketKey)
        end
    end

    -- Set all tickets to the current customer
    -- 모든 티켓을 현재 고객으로 설정
    for i = 1, #KEYS - 1 do
        local key = KEYS[i]
        redis.call('SET', key, customerId, 'PX', ttlMs)
    end

    -- Save the ticket list for the customer
    -- 고객에 대한 티켓 목록 저장
    redis.call('SET', customerKey, ticketIdsJson, 'PX', ttlMs)

    -- Ticket holding succeeded
    -- 티켓 선점 성공
    return 1
`

@Injectable()
export class TicketHoldingService {
    constructor(@InjectCache('ticket-holding') private readonly cacheService: CacheService) {}

    async holdTickets({ customerId, showtimeId, ticketIds }: HoldTicketsDto) {
        const ticketKeys = ticketIds.map((ticketId) => getTicketKey(showtimeId, ticketId))
        const customerKeyStr = getCustomerKey(showtimeId, customerId)
        const keys = [...ticketKeys, customerKeyStr]
        const scriptArgs = [
            customerId,
            Rules.Ticket.holdDurationInMs.toString(),
            JSON.stringify(ticketIds),
            showtimeId
        ]

        const result = await this.cacheService.executeScript(HOLD_TICKETS_SCRIPT, keys, scriptArgs)

        return result === 1
    }

    async releaseTickets(showtimeId: string, customerId: string): Promise<void> {
        const tickets = await this.searchHeldTicketIds(showtimeId, customerId)

        await Promise.all(
            tickets.map((ticketId) => this.cacheService.delete(getTicketKey(showtimeId, ticketId)))
        )

        await this.cacheService.delete(getCustomerKey(showtimeId, customerId))
    }

    async searchHeldTicketIds(showtimeId: string, customerId: string): Promise<string[]> {
        const tickets = await this.cacheService.get(getCustomerKey(showtimeId, customerId))

        return tickets ? JSON.parse(tickets) : []
    }
}
