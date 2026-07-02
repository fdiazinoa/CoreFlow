export interface PaginationParams {
    page?: number;
    pageSize?: number;
}

export interface PaginatedResult<T> {
    data: T[];
    count: number | null;
    page: number;
    pageSize: number;
    totalPages: number;
}
