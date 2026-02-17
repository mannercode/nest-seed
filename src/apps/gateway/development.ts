import { bootstrap } from './main'

process.loadEnvFile('.env')
process.env.NODE_ENV = 'development'

void bootstrap()
