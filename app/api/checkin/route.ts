import { query, queryOne } from "@/lib/db";
import { getUserId, unauthorized } from "@/lib/session";
export const dynamic="force-dynamic";
export async function GET() {
  const u=await getUserId(); if(!u) return unauthorized();
  const checkin=await queryOne(`SELECT sleep_hours,initial_energy,initial_mood,tasks_text
    FROM daily_checkins WHERE user_id=$1 AND plan_date=CURRENT_DATE`,[u]);
  return Response.json({checkin});
}
export async function POST(req: Request) {
  const u=await getUserId(); if(!u) return unauthorized();
  const b=await req.json().catch(()=>null);
  const s=Number(b?.sleep_hours),e=Number(b?.initial_energy),m=Number(b?.initial_mood);
  if(!Number.isFinite(s)||!Number.isFinite(e)||!Number.isFinite(m))
    return Response.json({error:"sleep_hours, initial_energy, initial_mood required"},{status:400});
  await query(`INSERT INTO daily_checkins
    (user_id,plan_date,sleep_hours,initial_energy,initial_mood,tasks_text)
    VALUES ($1,CURRENT_DATE,$2,$3,$4,$5)
    ON CONFLICT (user_id,plan_date) DO UPDATE SET sleep_hours=EXCLUDED.sleep_hours,
      initial_energy=EXCLUDED.initial_energy, initial_mood=EXCLUDED.initial_mood,
      tasks_text=EXCLUDED.tasks_text`,[u,s,e,m,String(b?.tasks_text??"")]);
  await query(`INSERT INTO student_events (time,user_id,event_type,numeric_value)
    VALUES (NOW(),$1,'energy_checkin',$2)`,[u,e]);
  return Response.json({ok:true});
}
