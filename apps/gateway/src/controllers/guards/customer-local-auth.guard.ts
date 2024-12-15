import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class CustomerLocalAuthGuard extends AuthGuard('customer-local') {}
