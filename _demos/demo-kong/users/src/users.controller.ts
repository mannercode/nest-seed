/**
 * 사용자 서비스 컨트롤러.
 *
 * Kong를 통해 /users 경로로 들어온 요청이 이 서비스로 라우팅된다.
 * Kong 설정에서 strip_path: false이므로 /users 경로가 그대로 전달된다.
 */
import { Controller, Get, Post, Param, Body } from '@nestjs/common'

// 인메모리 데이터 (데모용)
const users = [
    { id: '1', name: '홍길동', email: 'hong@example.com' },
    { id: '2', name: '김철수', email: 'kim@example.com' }
]

@Controller('users')
export class UsersController {
    @Get()
    findAll() {
        return users
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return users.find((u) => u.id === id) ?? { error: 'User not found' }
    }

    @Post()
    create(@Body() body: { name: string; email: string }) {
        const user = { id: String(users.length + 1), ...body }
        users.push(user)
        return user
    }

    @Get('health')
    health() {
        return { status: 'ok', service: 'users' }
    }
}
