import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Req,
    UseGuards
} from '@nestjs/common'
import { CreateTextJobSchema, JobDemoService, type CreateTextJobDto } from '#infrastructure'
import { UserAuthGuard } from './guards/index.js'
import type { UserAuthRequest } from './types.js'

@Controller('job-demo')
@UseGuards(UserAuthGuard)
export class JobDemoHttpController {
    constructor(private readonly jobs: JobDemoService) {}
    @Post('jobs')
    @HttpCode(HttpStatus.ACCEPTED)
    async submit(
        @Req() req: UserAuthRequest,
        @Body({ schema: CreateTextJobSchema }) input: CreateTextJobDto
    ) {
        return this.jobs.submit(req.user.sub, input)
    }
    @Get('jobs/:jobId')
    async getStatus(@Req() req: UserAuthRequest, @Param('jobId') jobId: string) {
        return this.jobs.getStatus(req.user.sub, jobId)
    }
}
