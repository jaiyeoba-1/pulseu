import { queryOne } from "./db";

async function getAuth0Id(): Promise<string | null> {
  try {
    const { auth0 } = await import("./auth0");
    const session = await auth0.getSession();
    if (session?.user?.sub) return session.user.sub;
  } catch {}
  return process.env.DEV_USER_ID ?? null;
}

export async function getUserId(): Promise<string | null> {
  const auth0Id = await getAuth0Id();
  if (!auth0Id) return null;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO users (auth0_user_id) VALUES ($1)
     ON CONFLICT (auth0_user_id) DO UPDATE SET auth0_user_id=EXCLUDED.auth0_user_id
     RETURNING id`, [auth0Id]);
  return row?.id ?? null;
}

export function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}