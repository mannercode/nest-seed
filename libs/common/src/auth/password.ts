import { argon2id, hash, verify } from 'argon2'

export class PasswordHasher {
    private static dummyHash: Promise<string> | undefined

    static hash(rawPassword: string): Promise<string> {
        return hash(rawPassword, {
            memoryCost: 19 * 1024,
            parallelism: 1,
            timeCost: 2,
            type: argon2id
        })
    }

    static async verify(rawPassword: string, hashedPassword: string | undefined): Promise<boolean> {
        // 계정이 없어도 같은 해시 비교를 수행해 로그인 실패 응답 시간 차이를 줄인다.
        const targetHash =
            hashedPassword ?? (await (this.dummyHash ??= this.hash('timing-equalization-only')))
        const matches = await verify(targetHash, rawPassword)
        return hashedPassword !== undefined && matches
    }
}
