import { CacheService, getByPath, InjectCache } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { Rules } from 'config'
import { HoldTicketsDto } from './dtos'

const getUserKey = (showtimeId: string, userId: string) => `User:{${showtimeId}}:${userId}`
const getTicketKey = (showtimeId: string, ticketId: string) => `Ticket:{${showtimeId}}:${ticketId}`

const HOLD_TICKETS_SCRIPT = `
    local prefix = ARGV[1]
    local userId = ARGV[2]
    local ttlMs = tonumber(ARGV[3])
    local ticketIdsJson = ARGV[4]
    local showtimeId = ARGV[5]

    -- 티켓이 이미 다른 고객에 의해 선점되었는지 확인
    for i = 1, #KEYS - 1 do
        local key = KEYS[i]
        local ownerId = redis.call('GET', key)
        if ownerId and ownerId ~= userId then
            -- 티켓 선점 실패
            return 0
        end
    end

    -- 고객 키 (KEYS 배열의 마지막 요소)
    local userKey = KEYS[#KEYS]

    -- 이전에 고객이 선점한 티켓 목록 가져오기.
    -- partial-release-failure 시나리오 (ticket-key 만 삭제되고 user-key 가 남거나
    -- 그 반대) 에서 stale 한 ticketId 가 섞일 수 있으므로, 소유자가 *우리*
    -- userId 인 키만 DEL 한다. 그래야 그 사이에 다른 고객이 같은 ticketId 를
    -- 다시 선점한 경우, 이 cleanup 으로 그 hold 가 끊기지 않는다.
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

    -- 모든 티켓을 현재 고객으로 설정
    for i = 1, #KEYS - 1 do
        local key = KEYS[i]
        redis.call('SET', key, userId, 'PX', ttlMs)
    end

    -- 고객에 대한 티켓 목록 저장
    redis.call('SET', userKey, ticketIdsJson, 'PX', ttlMs)

    -- 티켓 선점 성공
    return 1
`

@Injectable()
export class TicketHoldingService {
    private readonly logger = new Logger(TicketHoldingService.name)

    constructor(@InjectCache('ticket-holding') private readonly cacheService: CacheService) {}

    async holdTickets({ userId, showtimeId, ticketIds }: HoldTicketsDto) {
        const ticketKeys = ticketIds.map((ticketId) => getTicketKey(showtimeId, ticketId))
        const userKeyStr = getUserKey(showtimeId, userId)
        const keys = [...ticketKeys, userKeyStr]
        const scriptArgs = [
            userId,
            Rules.Ticket.holdDurationInMs.toString(),
            JSON.stringify(ticketIds),
            showtimeId
        ]

        const result = await this.cacheService.executeScript(HOLD_TICKETS_SCRIPT, keys, scriptArgs)

        return result === 1
    }

    async releaseTickets(showtimeId: string, userId: string): Promise<void> {
        const tickets = await this.searchHeldTicketIds(showtimeId, userId)

        // 한 ticket-key 삭제가 실패해도 나머지와 user-key 정리는 계속 진행한다.
        // hold TTL 로 결국 회복되므로 부분 실패가 영구 잠금으로 이어지지 않는다.
        // 다음 holdTickets 의 Lua 스크립트가 user-key 를 다시 읽어 잔존 ticket-key 를
        // DEL 하므로 user-key 만 살아남으면 자가 치유된다.
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
