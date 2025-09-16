export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    cursor?: number;
    nextCursor?: number;
    hasMore: boolean;
  };
}

export function createPaginatedResponse<T>(
  items: T[],
  limit: number,
  cursor: number,
  getItemId: (item: T) => number,
): PaginatedResponse<T> {
  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, -1) : items;
  // biome-ignore lint/style/noNonNullAssertion: we've already checked length
  const lastItemId = resultItems.length > 0 ? getItemId(resultItems[resultItems.length - 1]!) : undefined;

  return {
    data: resultItems,
    pagination: {
      limit,
      ...(cursor > 0 && { cursor }),
      ...(hasMore && lastItemId !== undefined && { nextCursor: lastItemId }),
      hasMore,
    },
  };
}
