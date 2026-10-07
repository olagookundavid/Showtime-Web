export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

export interface GenericApiResponse<T> {
    message: string;
    data: T;
}

export interface Paged<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}
