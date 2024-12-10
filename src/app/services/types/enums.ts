/**
 * enum은 서비스의 기능이 아니다.
 * 특정 서비스에 종속될 수 없는 개념이기 때문에 공통 타입으로 관리한다.
 */

export enum MovieGenre {
    Action = 'Action',
    Comedy = 'Comedy',
    Drama = 'Drama',
    Fantasy = 'Fantasy',
    Horror = 'Horror',
    Mystery = 'Mystery',
    Romance = 'Romance',
    Thriller = 'Thriller',
    Western = 'Western'
}

export enum MovieRating {
    G = 'G',
    PG = 'PG',
    PG13 = 'PG13',
    R = 'R',
    NC17 = 'NC17'
}

export enum PurchaseItemType {
    ticket = 'ticket'
}

export enum TicketStatus {
    available = 'available',
    sold = 'sold'
}
