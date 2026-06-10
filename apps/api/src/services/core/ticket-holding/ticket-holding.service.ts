import { CacheService, InjectCache } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from 'config'
import { HoldTicketsDto } from './dtos'

// Redis Cluster는 한 스크립트에서 다룰 키가 같은 저장 구역(hash slot)에 있어야 한다.
// `{showtimeId}`를 키에 넣어 같은 상영의 사용자 키와 티켓 키를 한곳에 모은다.
const getUserKey = (showtimeId: string, userId: string) => `User:{${showtimeId}}:${userId}`
const getTicketKey = (showtimeId: string, ticketId: string) => `Ticket:{${showtimeId}}:${ticketId}`

const HOLD_TICKETS_SCRIPT = `
    local prefix = ARGV[1]
    local userId = ARGV[2]
    local ttlMs = tonumber(ARGV[3])
    local ticketIdsJson = ARGV[4]
    local showtimeId = ARGV[5]

    for i = 1, #KEYS - 1 do
        local key = KEYS[i]
        local ownerId = redis.call('GET', key)
        if ownerId and ownerId ~= userId then
            return 0
        end
    end

    local userKey = KEYS[#KEYS]

    -- 같은 사용자가 선점을 갱신하면 user 키에 이전 ticketId 목록이 남아 있다.
    -- TTL 만료 시점 차이로 그중 일부를 이제 다른 사용자가 소유했을 수 있으므로,
    -- 현재 사용자 소유로 확인된 ticket 키만 DEL 한다.
    -- 소유자가 다르면 그대로 두어 다른 사용자의 선점을 해제하지 않는다.
    local previousTicketIdsJson = redis.call('GET', userKey)
    if previousTicketIdsJson then
        local previousTicketIds = cjson.decode(previousTicketIdsJson)
        for _, ticketId in ipairs(previousTicketIds) do
            local ticketKey = prefix .. ':Ticket:{' .. showtimeId .. '}:' .. ticketId
            local ownerId = redis.call('GET', ticketKey)
            if ownerId == userId then
                redis.call('DEL', ticketKey)
            end
        end
    end

    for i = 1, #KEYS - 1 do
        local key = KEYS[i]
        redis.call('SET', key, userId, 'PX', ttlMs)
    end

    redis.call('SET', userKey, ticketIdsJson, 'PX', ttlMs)

    return 1
`

@Injectable()
export class TicketHoldingService {
    constructor(
        @InjectCache('ticket-holding') private readonly cacheService: CacheService,
        private readonly config: AppConfigService
    ) {}

    async holdTickets({ userId, showtimeId, ticketIds }: HoldTicketsDto) {
        const ticketKeys = ticketIds.map((ticketId) => getTicketKey(showtimeId, ticketId))
        const userKeyStr = getUserKey(showtimeId, userId)
        const keys = [...ticketKeys, userKeyStr]
        const scriptArgs = [
            userId,
            this.config.ticket.holdDurationInMs.toString(),
            JSON.stringify(ticketIds),
            showtimeId
        ]

        const result = await this.cacheService.executeScript(HOLD_TICKETS_SCRIPT, keys, scriptArgs)

        return result === 1
    }

    async searchHeldTicketIds(showtimeId: string, userId: string): Promise<string[]> {
        const tickets = await this.cacheService.get(getUserKey(showtimeId, userId))

        return tickets ? JSON.parse(tickets) : []
    }
}
