import * as dotenv from 'dotenv'
import 'reflect-metadata'

dotenv.config({ path: ['.env.app', '.env.infra'] })

process.env.NODE_ENV = 'test'
// testcontainers에서 testcontainers/ryuk 이미지 사용하지 않게 한다
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true'
