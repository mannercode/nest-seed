import { CacheService, getByPath, InjectCache } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { AppConfigService } from 'config'
import { HoldTicketsDto } from './dtos'

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

    -- 이전 해제가 중간에 실패해 ticket 키와 user 키가 어긋난 적이 있었다면,
    -- user 키에 이미 다른 사람 차지가 된 ticketId가 섞여 있을 수 있다.
    -- 그래서 소유자가 우리와 같은 키만 DEL 한다. 같지 않은 키는 그대로
    -- 두어서, 다른 사람이 새로 획득한 hold를 우리가 끊지 않게 한다.
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
    private readonly logger = new Logger(TicketHoldingService.name)

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

    async releaseTickets(showtimeId: string, userId: string): Promise<void> {
        const tickets = await this.searchHeldTicketIds(showtimeId, userId)

        // 티켓 키 하나를 삭제하지 못해도 나머지 티켓 키와 사용자 키 정리는 계속한다.
        // 부분 실패가 영구 잠금으로 이어지지 않는 이유는 두 가지이다.
        // 첫째, 선점에 걸린 TTL이 끝나면 남은 키가 사라진다.
        // 둘째, 다음 `holdTickets`가 사용자 키를 다시 읽어 같은 사용자의 남은
        // 티켓 키를 정리한다.
        const results = await Promise.allSettled(
            tickets.map((ticketId) => this.cacheService.delete(getTicketKey(showtimeId, ticketId)))
        )
        const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        if (failed.length > 0) {
            this.logger.warn('partial ticket release failure', {
                failedCount: failed.length,
                reasons: failed.map((r) => getByPath(r, 'reason.message', String(r.reason))),
                showtimeId,
                totalCount: tickets.length,
                userId
            })
        }

        await this.cacheService.delete(getUserKey(showtimeId, userId))
    }

    async searchHeldTicketIds(showtimeId: string, userId: string): Promise<string[]> {
        const tickets = await this.cacheService.get(getUserKey(showtimeId, userId))

        return tickets ? JSON.parse(tickets) : []
    }
}
