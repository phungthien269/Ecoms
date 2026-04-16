import { cookies } from "next/headers";

export interface DemoSession {
  accessToken: string;
  email: string;
  role: string;
}

export async function getDemoSession(): Promise<DemoSession | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("ecoms_access_token")?.value;
  const email = cookieStore.get("ecoms_user_email")?.value;
  const role = cookieStore.get("ecoms_user_role")?.value;

  if (!accessToken || !email || !role) {
    return null;
  }

  return {
    accessToken,
    email,
    role
  };
}
