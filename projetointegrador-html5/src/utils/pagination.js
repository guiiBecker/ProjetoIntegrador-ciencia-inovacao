export function normalizePaginatedResponse(data, fallbackLimit = 20) {
  if (Array.isArray(data)) {
    return {
      items: data,
      page: 1,
      limit: fallbackLimit,
      total: data.length,
      totalPages: data.length > 0 ? 1 : 0,
    };
  }

  if (data && Array.isArray(data.items)) {
    return {
      items: data.items,
      page: Number(data.page) || 1,
      limit: Number(data.limit) || fallbackLimit,
      total: Number(data.total) || 0,
      totalPages: Number(data.totalPages) || 0,
    };
  }

  return {
    items: [],
    page: 1,
    limit: fallbackLimit,
    total: 0,
    totalPages: 0,
  };
}