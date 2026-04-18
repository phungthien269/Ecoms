export interface AdminListSearchParams {
  adminMessage?: string;
  adminScope?: string;
  adminStatus?: string;
  action?: string;
  actorRole?: string;
  category?: string;
  entityType?: string;
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
    adminMessage: getSingleValue(searchParams?.adminMessage),
    adminScope: getSingleValue(searchParams?.adminScope),
    adminStatus: getSingleValue(searchParams?.adminStatus),
    action: getSingleValue(searchParams?.action),
    actorRole: getSingleValue(searchParams?.actorRole),
    category: getSingleValue(searchParams?.category),
    entityType: getSingleValue(searchParams?.entityType),
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

export function buildAdminFlashHref(
  basePath: string,
  params: AdminListSearchParams,
  flash?: {
    scope: string;
    status: "success" | "error";
    message: string;
  }
) {
  const nextParams = {
    ...params,
    ...(flash
      ? {
          adminScope: flash.scope,
          adminStatus: flash.status,
          adminMessage: flash.message
        }
      : {})
  };

  return buildAdminHref(basePath, nextParams);
}

export function clearAdminFlash(params: AdminListSearchParams): AdminListSearchParams {
  return {
    ...params,
    adminMessage: undefined,
    adminScope: undefined,
    adminStatus: undefined
  };
}
