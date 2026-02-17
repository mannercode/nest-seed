import { bootstrap } from './main'

process.loadEnvFile('.env')
process.env.NODE_ENV = 'development'
process.env.HTTP_PORT = '4002'

void bootstrap()
