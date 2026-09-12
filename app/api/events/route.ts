import { query } from "@/lib/db";
import { getUserId, unauthorized } from "@/lib/session";
export const dynamic="force-dynamic";
const OK=new Set(["study_started","study_completed","break_logged","meal_logged","energy_checkin"]);
export async function POST(req: Request) {
  const u=await getUserId(); if(!u) return unauthorized();
  const b=await req.json().catch(()=>null);
  if(!OK.has(b?.event_type)) return Response.json({error:"bad event_type"},{status:400});
  await query(`INSERT INTO student_events (time,user_id,event_type,numeric_value)
    VALUES (NOW(),$1,$2,$3)`,[u,b.event_type,b.numeric_value??null]);
  return Response.json({ok:true});
}
export async function GET() {
  const u=await getUserId(); if(!u) return unauthorized();
  const events=await query(`SELECT time,event_type,numeric_value FROM student_events
    WHERE user_id=$1 AND time>=date_trunc('day',NOW()) ORDER BY time ASC`,[u]);
  const curve=await query(`SELECT time_bucket('30 minutes',time) AS t,
    ROUND(AVG(numeric_value)::numeric,1) AS energy FROM student_events
    WHERE user_id=$1 AND event_type='energy_checkin' AND time>=date_trunc('day',NOW())
    GROUP BY t ORDER BY t`,[u]);
  const totals={
    study_minutes:events.filter(e=>e.event_type==="study_completed").reduce((s,e)=>s+Number(e.numeric_value??0),0),
    breaks:events.filter(e=>e.event_type==="break_logged").length,
    meals:events.filter(e=>e.event_type==="meal_logged").length};
  return Response.json({events,curve,totals});
}
