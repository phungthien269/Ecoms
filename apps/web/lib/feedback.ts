export interface FlashState {
  message?: string;
  scope?: string;
  status?: string;
}

export interface FlashInput {
  message: string;
  scope: string;
  status: "success" | "error";
}

type SearchParamValue = string | string[] | undefined;

export function getSingleQueryValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function readFlash(
  searchParams?: Record<string, SearchParamValue>
): FlashState {
  return {
    message: getSingleQueryValue(searchParams?.flashMessage),
    scope: getSingleQueryValue(searchParams?.flashScope),
    status: getSingleQueryValue(searchParams?.flashStatus)
  };
}

export function buildHref(
  basePath: string,
  params: Record<string, string | undefined>
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function buildFlashHref(
  basePath: string,
  params: Record<string, string | undefined>,
  flash?: FlashInput
) {
  return buildHref(basePath, {
    ...params,
    flashMessage: flash?.message,
    flashScope: flash?.scope,
    flashStatus: flash?.status
  });
}

export function clearFlash<T extends Record<string, string | undefined>>(params: T): T {
  return {
    ...params,
    flashMessage: undefined,
    flashScope: undefined,
    flashStatus: undefined
  };
}

export async function readActionErrorMessage(response: Response, fallback: string) {
  const text = (await response.text()).trim();
  if (!text) {
    return fallback;
  }

  try {
    const payload = JSON.parse(text) as {
      error?: { message?: string };
      message?: string;
    };

    if (payload.error?.message) {
      return payload.error.message;
    }

    if (payload.message) {
      return payload.message;
    }
  } catch {
    // Non-JSON responses should still surface meaningful text.
  }

  return text;
}
