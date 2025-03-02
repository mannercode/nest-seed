import 'reflect-metadata'
import dotenv from 'dotenv'
dotenv.config({ path: ['.env.test', '.env.infra'] })
process.env.NODE_ENV = 'test'

function generateTestId() {
    const characters = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'

    return Array.from(
        { length: 10 },
        () => characters[Math.floor(Math.random() * characters.length)]
    ).join('')
}

global.beforeEach(async () => {
    process.env.TEST_ID = generateTestId()
})
