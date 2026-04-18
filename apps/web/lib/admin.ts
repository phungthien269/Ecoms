export interface AdminListSearchParams {
  search?: string;
  status?: string;
  role?: string;
  isActive?: string;
  paymentMethod?: string;
  targetType?: string;
  shopStatus?: string;
  page?: string;
}

function getSingleValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export function normalizeAdminParams(
  searchParams?: Record<string, string | string[] | undefined>
): AdminListSearchParams {
  return {
    search: getSingleValue(searchParams?.search),
    status: getSingleValue(searchParams?.status),
    role: getSingleValue(searchParams?.role),
    isActive: getSingleValue(searchParams?.isActive),
    paymentMethod: getSingleValue(searchParams?.paymentMethod),
    targetType: getSingleValue(searchParams?.targetType),
    shopStatus: getSingleValue(searchParams?.shopStatus),
    page: getSingleValue(searchParams?.page)
  };
}

export function buildAdminHref(basePath: string, params: AdminListSearchParams) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}
