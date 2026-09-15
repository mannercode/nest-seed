import { CacheService, InjectCache, JsonUtil } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import { HoldTicketsDto } from './dtos/index.js'

type PurchaseTicketClaim = { purchaseRecordId: string; showtimeId: string; ticketIds: string[] }

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
        local owner = redis.call('GET', KEYS[i])
        if owner ~= userId and owner ~= purchaseOwner then
            return 0
        end
    end

    local userKey = KEYS[#KEYS]
    local heldTicketIdsJson = redis.call('GET', userKey)
    local userKeyTtlMs = redis.call('PTTL', userKey)
    local claimedKeys = {}

    for i = 1, #KEYS - 1 do
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
    end

    return 1
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
            JsonUtil.stringify(ticketIds),
            showtimeId
        ]

        const result = await this.cacheService.executeScript(HOLD_TICKETS_SCRIPT, keys, scriptArgs)

        return result === 1
    }

    async claimTicketsForPurchase({
        purchaseRecordId,
        showtimeId,
        ticketIds,
        userId
    }: PurchaseTicketClaim & { userId: string }) {
        const result = await this.cacheService.executeScript<number>(
            CLAIM_TICKETS_SCRIPT,
            [
                ...ticketIds.map((ticketId) => getTicketKey(showtimeId, ticketId)),
                getUserKey(showtimeId, userId)
            ],
            [
                userId,
                getPurchaseOwner(purchaseRecordId),
                PURCHASE_CLAIM_TTL_MS.toString(),
                showtimeId
            ]
        )
        return result === 1
    }

    async confirmPurchaseClaims({ purchaseRecordId, showtimeId, ticketIds }: PurchaseTicketClaim) {
        const result = await this.cacheService.executeScript<number>(
            CONFIRM_PURCHASE_CLAIM_SCRIPT,
            ticketIds.map((ticketId) => getTicketKey(showtimeId, ticketId)),
            [getPurchaseOwner(purchaseRecordId), PURCHASE_CLAIM_TTL_MS.toString()]
        )
        return result === 1
    }

    async releasePurchaseClaims({ purchaseRecordId, showtimeId, ticketIds }: PurchaseTicketClaim) {
        await this.cacheService.executeScript(
            RELEASE_PURCHASE_CLAIM_SCRIPT,
            ticketIds.map((ticketId) => getTicketKey(showtimeId, ticketId)),
            [getPurchaseOwner(purchaseRecordId)]
        )
    }

    async searchHeldTicketIds(showtimeId: string, userId: string): Promise<string[]> {
        const tickets = await this.cacheService.get(getUserKey(showtimeId, userId))

        return tickets ? JsonUtil.parse(tickets) : []
    }
}
