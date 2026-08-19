import { CacheService, InjectCache } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from 'config'
import { HoldTicketsDto } from './dtos'

type TicketReference = { id: string; showtimeId: string }
type ClaimedTicketGroup = {
    showtimeId: string
    ticketExpiresAtMs: number[]
    ticketIds: string[]
    userExpiresAtMs: number
}
type TicketClaimResult = [result: number, userExpiresAtMs: number, ...ticketExpiresAtMs: number[]]

// Redis Cluster는 한 스크립트에서 다룰 키가 같은 저장 구역(hash slot)에 있어야 한다.
// `{showtimeId}`를 키에 넣어 같은 상영의 사용자 키와 티켓 키를 한곳에 모은다.
const getUserKey = (showtimeId: string, userId: string) => `User:{${showtimeId}}:${userId}`
const getTicketKey = (showtimeId: string, ticketId: string) => `Ticket:{${showtimeId}}:${ticketId}`
const getPurchaseOwner = (purchaseRecordId: string) => `Purchase:${purchaseRecordId}`

const PURCHASE_CLAIM_TTL_MS = 10 * 60 * 1000

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

const CLAIM_TICKETS_SCRIPT = `
    local prefix = ARGV[1]
    local userId = ARGV[2]
    local purchaseOwner = ARGV[3]
    local ttlMs = tonumber(ARGV[4])
    local showtimeId = ARGV[5]

    for i = 1, #KEYS - 1 do
        if redis.call('GET', KEYS[i]) ~= userId then
            return {0}
        end
    end

    local userKey = KEYS[#KEYS]
    local heldTicketIdsJson = redis.call('GET', userKey)
    local userKeyTtlMs = redis.call('PTTL', userKey)
    local redisTime = redis.call('TIME')
    local nowMs = tonumber(redisTime[1]) * 1000 + math.floor(tonumber(redisTime[2]) / 1000)
    local userExpiresAtMs = userKeyTtlMs > 0 and nowMs + userKeyTtlMs or userKeyTtlMs
    local claimedKeys = {}
    local ticketExpiresAtMs = {}

    for i = 1, #KEYS - 1 do
        local ticketTtlMs = redis.call('PTTL', KEYS[i])
        ticketExpiresAtMs[i] = ticketTtlMs > 0 and nowMs + ticketTtlMs or ticketTtlMs
        claimedKeys[KEYS[i]] = true
        redis.call('SET', KEYS[i], purchaseOwner, 'PX', ttlMs)
    end

    -- 부분 구매에서는 구매하지 않은 티켓을 원 사용자의 목록과 기존 TTL에 남긴다.
    -- 그 사이 owner가 바뀐 항목은 목록에서 제거해 ghost hold를 만들지 않는다.
    local remainingTicketIds = {}
    if heldTicketIdsJson then
        local heldTicketIds = cjson.decode(heldTicketIdsJson)
        for _, ticketId in ipairs(heldTicketIds) do
            local ticketKey = prefix .. ':Ticket:{' .. showtimeId .. '}:' .. ticketId
            if not claimedKeys[ticketKey] and redis.call('GET', ticketKey) == userId then
                table.insert(remainingTicketIds, ticketId)
            end
        end
    end

    if #remainingTicketIds == 0 then
        redis.call('DEL', userKey)
    elseif userKeyTtlMs > 0 then
        redis.call('SET', userKey, cjson.encode(remainingTicketIds), 'PX', userKeyTtlMs)
    elseif userKeyTtlMs == -1 then
        redis.call('SET', userKey, cjson.encode(remainingTicketIds))
    end

    -- 뒤 showtime claim 실패 시 원 hold를 같은 만료시각 안에서 복원할 수 있도록
    -- 성공 여부, user 만료시각, 각 ticket 만료시각을 함께 반환한다.
    local result = {1, userExpiresAtMs}
    for i = 1, #ticketExpiresAtMs do
        table.insert(result, ticketExpiresAtMs[i])
    end
    return result
`

const CONFIRM_PURCHASE_CLAIM_SCRIPT = `
    local purchaseOwner = ARGV[2]
    local ttlMs = tonumber(ARGV[3])

    for i = 1, #KEYS do
        if redis.call('GET', KEYS[i]) ~= purchaseOwner then
            return 0
        end
    end

    -- 결제 중 줄어든 TTL을 판매 직전에 다시 확보한다. 확인과 연장이 같은 Lua 호출이라
    -- 다른 고객이 그 사이 ticket 키를 선점할 수 없다.
    for i = 1, #KEYS do
        redis.call('PEXPIRE', KEYS[i], ttlMs)
    end
    return 1
`

const RELEASE_PURCHASE_CLAIM_SCRIPT = `
    local purchaseOwner = ARGV[2]

    for i = 1, #KEYS do
        if redis.call('GET', KEYS[i]) == purchaseOwner then
            redis.call('DEL', KEYS[i])
        end
    end
    return 1
`

const ROLLBACK_PURCHASE_CLAIM_SCRIPT = `
    local prefix = ARGV[1]
    local purchaseOwner = ARGV[2]
    local userId = ARGV[3]
    local showtimeId = ARGV[4]
    local ticketIds = cjson.decode(ARGV[5])
    local ticketExpiresAtMs = cjson.decode(ARGV[6])
    local userExpiresAtMs = tonumber(ARGV[7])
    local userKey = KEYS[#KEYS]
    local redisTime = redis.call('TIME')
    local nowMs = tonumber(redisTime[1]) * 1000 + math.floor(tonumber(redisTime[2]) / 1000)
    local restoredTicketIds = {}
    local restoredExpiresAtMs = {}

    -- 이 구매가 여전히 소유한 key만 원 사용자에게 되돌린다. 이미 다른 owner가
    -- 얻은 key는 삭제하거나 덮어쓰지 않는다. 원 hold가 만료됐으면 claim만 제거한다.
    for i = 1, #KEYS - 1 do
        if redis.call('GET', KEYS[i]) == purchaseOwner then
            local expiresAtMs = tonumber(ticketExpiresAtMs[i])
            if expiresAtMs == -1 then
                redis.call('SET', KEYS[i], userId)
                table.insert(restoredTicketIds, ticketIds[i])
                table.insert(restoredExpiresAtMs, expiresAtMs)
            elseif expiresAtMs > nowMs then
                redis.call('SET', KEYS[i], userId, 'PX', math.floor(expiresAtMs - nowMs))
                table.insert(restoredTicketIds, ticketIds[i])
                table.insert(restoredExpiresAtMs, expiresAtMs)
            else
                redis.call('DEL', KEYS[i])
            end
        end
    end

    if #restoredTicketIds == 0 then
        return 1
    end

    -- 부분 구매나 rollback 사이의 새 hold가 만든 목록을 보존하면서 복원한 ticket을 합친다.
    -- 현재 user 소유가 아닌 오래된 목록 항목은 함께 정리한다.
    local mergedTicketIds = {}
    local seenTicketIds = {}
    local currentTicketIdsJson = redis.call('GET', userKey)
    local currentUserTtlMs = redis.call('PTTL', userKey)
    if currentTicketIdsJson then
        local currentTicketIds = cjson.decode(currentTicketIdsJson)
        for _, ticketId in ipairs(currentTicketIds) do
            local ticketKey = prefix .. ':Ticket:{' .. showtimeId .. '}:' .. ticketId
            if redis.call('GET', ticketKey) == userId and not seenTicketIds[ticketId] then
                table.insert(mergedTicketIds, ticketId)
                seenTicketIds[ticketId] = true
            end
        end
    end
    for _, ticketId in ipairs(restoredTicketIds) do
        if not seenTicketIds[ticketId] then
            table.insert(mergedTicketIds, ticketId)
            seenTicketIds[ticketId] = true
        end
    end

    -- 기존 목록과 복원 ticket 중 가장 늦게 끝나는 정상 hold까지 목록을 유지한다.
    -- 복원 ticket key 자체는 위에서 캡처한 원 만료시각을 절대 넘기지 않는다.
    local persistWithoutExpiry = userExpiresAtMs == -1 or currentUserTtlMs == -1
    local mergedExpiresAtMs = userExpiresAtMs
    if currentUserTtlMs > 0 then
        mergedExpiresAtMs = math.max(mergedExpiresAtMs, nowMs + currentUserTtlMs)
    end
    for _, expiresAtMs in ipairs(restoredExpiresAtMs) do
        if expiresAtMs == -1 then
            persistWithoutExpiry = true
        else
            mergedExpiresAtMs = math.max(mergedExpiresAtMs, expiresAtMs)
        end
    end

    if persistWithoutExpiry then
        redis.call('SET', userKey, cjson.encode(mergedTicketIds))
    elseif mergedExpiresAtMs > nowMs then
        redis.call(
            'SET',
            userKey,
            cjson.encode(mergedTicketIds),
            'PX',
            math.floor(mergedExpiresAtMs - nowMs)
        )
    else
        redis.call('DEL', userKey)
    end
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

    async claimTicketsForPurchase({
        purchaseRecordId,
        tickets,
        userId
    }: {
        purchaseRecordId: string
        tickets: TicketReference[]
        userId: string
    }) {
        const groups = this.groupByShowtime(tickets)
        const claimed: ClaimedTicketGroup[] = []
        const purchaseOwner = getPurchaseOwner(purchaseRecordId)

        // Redis Cluster에서는 서로 다른 showtime hash slot을 한 Lua 호출에 넣을 수 없다.
        // showtime별로 claim하되 실패하면 앞서 얻은 claim만 소유 토큰 조건으로 되돌린다.
        for (const [showtimeId, ticketIds] of groups) {
            const keys = [
                ...ticketIds.map((ticketId) => getTicketKey(showtimeId, ticketId)),
                getUserKey(showtimeId, userId)
            ]
            const [result, userExpiresAtMs, ...ticketExpiresAtMs] =
                await this.cacheService.executeScript<TicketClaimResult>(
                    CLAIM_TICKETS_SCRIPT,
                    keys,
                    [userId, purchaseOwner, PURCHASE_CLAIM_TTL_MS.toString(), showtimeId]
                )

            if (result !== 1) {
                await this.rollbackGroups(purchaseOwner, userId, claimed)
                return false
            }
            claimed.push({ showtimeId, ticketExpiresAtMs, ticketIds, userExpiresAtMs })
        }

        return true
    }

    async confirmPurchaseClaims(purchaseRecordId: string, tickets: TicketReference[]) {
        const purchaseOwner = getPurchaseOwner(purchaseRecordId)

        // 서로 다른 hash slot은 하나의 Lua로 확인할 수 없으므로 showtime별로 확인한다.
        // 뒤 그룹이 실패하면 호출자의 보상 경로가 아직 이 구매 소유인 claim만 해제한다.
        for (const [showtimeId, ticketIds] of this.groupByShowtime(tickets)) {
            const result = await this.cacheService.executeScript<number>(
                CONFIRM_PURCHASE_CLAIM_SCRIPT,
                ticketIds.map((ticketId) => getTicketKey(showtimeId, ticketId)),
                [purchaseOwner, PURCHASE_CLAIM_TTL_MS.toString()]
            )
            if (result !== 1) return false
        }

        return true
    }

    async releasePurchaseClaims(purchaseRecordId: string, tickets: TicketReference[]) {
        await this.releaseGroups(getPurchaseOwner(purchaseRecordId), this.groupByShowtime(tickets))
    }

    async searchHeldTicketIds(showtimeId: string, userId: string): Promise<string[]> {
        const tickets = await this.cacheService.get(getUserKey(showtimeId, userId))

        return tickets ? JSON.parse(tickets) : []
    }

    private groupByShowtime(tickets: TicketReference[]): Array<[string, string[]]> {
        const groups = new Map<string, string[]>()
        for (const ticket of tickets) {
            const ticketIds = groups.get(ticket.showtimeId) ?? []
            ticketIds.push(ticket.id)
            groups.set(ticket.showtimeId, ticketIds)
        }

        return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))
    }

    private async releaseGroups(
        purchaseOwner: string,
        groups: Array<[string, string[]]>
    ): Promise<void> {
        await Promise.all(
            groups.map(([showtimeId, ticketIds]) =>
                this.cacheService.executeScript(
                    RELEASE_PURCHASE_CLAIM_SCRIPT,
                    ticketIds.map((ticketId) => getTicketKey(showtimeId, ticketId)),
                    [purchaseOwner]
                )
            )
        )
    }

    private async rollbackGroups(
        purchaseOwner: string,
        userId: string,
        groups: ClaimedTicketGroup[]
    ): Promise<void> {
        await Promise.all(
            groups.map(({ showtimeId, ticketExpiresAtMs, ticketIds, userExpiresAtMs }) =>
                this.cacheService.executeScript(
                    ROLLBACK_PURCHASE_CLAIM_SCRIPT,
                    [
                        ...ticketIds.map((ticketId) => getTicketKey(showtimeId, ticketId)),
                        getUserKey(showtimeId, userId)
                    ],
                    [
                        purchaseOwner,
                        userId,
                        showtimeId,
                        JSON.stringify(ticketIds),
                        JSON.stringify(ticketExpiresAtMs),
                        userExpiresAtMs.toString()
                    ]
                )
            )
        )
    }
}
