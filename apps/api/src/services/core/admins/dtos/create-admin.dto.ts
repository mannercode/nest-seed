import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

// admin은 dev 시드와 내부 호출로만 생성되므로 외부 HTTP DTO와 형태만 같게 둔다.
// signup 엔드포인트가 없기 때문에 validation은 시드/테스트 입력을 막을 때만 의미가 있다.
export class CreateAdminDto {
    @IsEmail()
    @IsNotEmpty()
    email: string

    @IsNotEmpty()
    @IsString()
    name: string

    @IsNotEmpty()
    @IsString()
    password: string
}
