import { compare, hash, hashSync } from 'bcrypt'

const BCRYPT_SALT_ROUNDS = 10
// 계정이 없어도 같은 해시 비교를 수행해 로그인 실패 응답 시간 차이를 줄인다.
const TIMING_DUMMY_HASH = hashSync('timing-equalization-only', BCRYPT_SALT_ROUNDS)

export class PasswordHasher {
    static hash(rawPassword: string): Promise<string> {
        return hash(rawPassword, BCRYPT_SALT_ROUNDS)
    }

    static verify(rawPassword: string, hashedPassword: string | undefined): Promise<boolean> {
        return compare(rawPassword, hashedPassword ?? TIMING_DUMMY_HASH)
    }
}
