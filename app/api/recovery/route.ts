import { query, queryOne } from "@/lib/db";
import { getUserId, unauthorized } from "@/lib/session";
import { scoreDay, buildGeminiContext } from "@/lib/score";
import { generateRecoveryPlan } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const u = await getUserId();
  if (!u) return unauthorized();

  const events = await query(
    `SELECT time,event_type,numeric_value FROM student_events
     WHERE user_id=$1 AND time>=date_trunc('day',NOW()) ORDER BY time ASC`, [u]);

  const checkin = (await queryOne(
    `SELECT sleep_hours,initial_energy,tasks_text FROM daily_checkins
     WHERE user_id=$1 AND plan_date=CURRENT_DATE`, [u]))
    ?? { sleep_hours: null, initial_energy: null, tasks_text: null };

  const baseline = await queryOne(
    `SELECT ROUND(AVG(avg_energy)::numeric,1) AS base_energy,
            ROUND(AVG(study_minutes)::numeric,0) AS base_study,
            ROUND(AVG(breaks)::numeric,1) AS base_breaks
     FROM daily_stats WHERE user_id=$1
       AND day>=NOW()-INTERVAL '30 days' AND day<date_trunc('day',NOW())`, [u]);

  const result = scoreDay(events, checkin, baseline);
  const context = buildGeminiContext(result, checkin, baseline);

  try {
    const plan = await generateRecoveryPlan(context);
    await query(
      `INSERT INTO recommendations (user_id,risk_score,risk_level,payload)
       VALUES ($1,$2,$3,$4)`,
      [u, result.score, result.level, JSON.stringify(plan)]);
    return Response.json({ score: result, plan, cached: false });
  } catch (err) {
    console.error("[recovery]", err);
    // Only reuse a cached plan written for this exact score, or the text
    // contradicts the number on screen.
    const last = await queryOne(
      `SELECT payload FROM recommendations
       WHERE user_id=$1 AND risk_score=$2
       ORDER BY generated_at DESC LIMIT 1`, [u, result.score]);
    return Response.json({ score: result, plan: last?.payload ?? null, cached: true });
  }
}
