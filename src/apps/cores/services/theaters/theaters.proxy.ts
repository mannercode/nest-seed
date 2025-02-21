import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Subjects } from 'shared/config'
import { TheaterCreateDto, TheaterDto, TheaterQueryDto, TheaterUpdateDto } from './dtos'

@Injectable()
export class TheatersProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    createTheater(createDto: TheaterCreateDto): Promise<TheaterDto> {
        return getProxyValue(this.service.send(Subjects.Theaters.createTheater, createDto))
    }

    @MethodLog({ level: 'verbose' })
    updateTheater(theaterId: string, updateDto: TheaterUpdateDto): Promise<TheaterDto> {
        return getProxyValue(
            this.service.send(Subjects.Theaters.updateTheater, { theaterId, updateDto })
        )
    }

    @MethodLog({ level: 'verbose' })
    getTheater(theaterId: string): Promise<TheaterDto> {
        return getProxyValue(this.service.send(Subjects.Theaters.getTheater, theaterId))
    }

    @MethodLog({ level: 'verbose' })
    deleteTheater(theaterId: string): Promise<boolean> {
        return getProxyValue(this.service.send(Subjects.Theaters.deleteTheater, theaterId))
    }

    @MethodLog({ level: 'verbose' })
    findTheaters(queryDto: TheaterQueryDto): Promise<TheaterDto[]> {
        return getProxyValue(this.service.send(Subjects.Theaters.findTheaters, queryDto))
    }

    @MethodLog({ level: 'verbose' })
    getTheatersByIds(theaterIds: string[]): Promise<TheaterDto[]> {
        return getProxyValue(this.service.send(Subjects.Theaters.getTheatersByIds, theaterIds))
    }

    @MethodLog({ level: 'verbose' })
    theatersExist(theaterIds: string[]): Promise<boolean> {
        return getProxyValue(this.service.send(Subjects.Theaters.theatersExist, theaterIds))
    }
}
