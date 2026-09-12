import { query, queryOne } from "@/lib/db";
import { getUserId, unauthorized } from "@/lib/session";
export const dynamic="force-dynamic";
export async function GET() {
  const u=await getUserId(); if(!u) return unauthorized();
  const comparison=await queryOne(
    `WITH baseline AS (
       SELECT ROUND(AVG(avg_energy)::numeric,1) AS base_energy,
              ROUND(AVG(study_minutes)::numeric,0) AS base_study,
              ROUND(AVG(breaks)::numeric,1) AS base_breaks, COUNT(*) AS days_of_history
       FROM daily_stats WHERE user_id=$1 AND day>=NOW()-INTERVAL '30 days'
         AND day<date_trunc('day',NOW())
     ), today AS (
       SELECT ROUND(AVG(numeric_value) FILTER (WHERE event_type='energy_checkin')::numeric,1) AS energy,
              COALESCE(SUM(numeric_value) FILTER (WHERE event_type='study_completed'),0) AS study,
              COUNT(*) FILTER (WHERE event_type='break_logged') AS breaks
       FROM student_events WHERE user_id=$1 AND time>=date_trunc('day',NOW())
     )
     SELECT t.energy,b.base_energy,(t.energy-b.base_energy) AS energy_delta,
            t.study,b.base_study,t.breaks,b.base_breaks,b.days_of_history
     FROM today t CROSS JOIN baseline b`,[u]);
  const history=await query(`SELECT day, ROUND(avg_energy::numeric,1) AS avg_energy,
    study_minutes, breaks FROM daily_stats WHERE user_id=$1
    AND day>=NOW()-INTERVAL '30 days' ORDER BY day ASC`,[u]);
  return Response.json({comparison,history});
}
