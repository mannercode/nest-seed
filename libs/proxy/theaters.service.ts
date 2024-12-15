import { Injectable } from '@nestjs/common'
import { ClientProxyService, MethodLog } from 'common'
import { Observable } from 'rxjs'
import { TheaterCreateDto, TheaterDto, TheaterQueryDto, TheaterUpdateDto } from 'types'

@Injectable()
export class TheatersService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createTheater(createDto: TheaterCreateDto): Observable<TheaterDto> {
        return this.service.send('createTheater', createDto)
    }

    @MethodLog({ level: 'verbose' })
    updateTheater(theaterId: string, updateDto: TheaterUpdateDto): Observable<TheaterDto> {
        return this.service.send('updateTheater', { theaterId, updateDto })
    }

    @MethodLog({ level: 'verbose' })
    getTheater(theaterId: string): Observable<TheaterDto> {
        return this.service.send('getTheater', theaterId)
    }

    @MethodLog({ level: 'verbose' })
    deleteTheater(theaterId: string): Observable<boolean> {
        return this.service.send('deleteTheater', theaterId)
    }

    @MethodLog({ level: 'verbose' })
    findTheaters(queryDto: TheaterQueryDto): Observable<TheaterDto[]> {
        return this.service.send('findTheaters', queryDto)
    }

    @MethodLog({ level: 'verbose' })
    getTheatersByIds(theaterIds: string[]): Observable<TheaterDto[]> {
        return this.service.send('getTheatersByIds', theaterIds)
    }

    @MethodLog({ level: 'verbose' })
    theatersExist(theaterIds: string[]): Observable<boolean> {
        return this.service.send('theatersExist', theaterIds)
    }
}
