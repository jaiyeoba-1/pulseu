export function scoreDay(events: any[], checkin: any, baseline?: any) {
  const rows = [...events].sort((a,b)=>new Date(a.time).getTime()-new Date(b.time).getTime());
  const studyMinutes = rows.filter(e=>e.event_type==="study_completed").reduce((s,e)=>s+Number(e.numeric_value??0),0);
  const breaks = rows.filter(e=>e.event_type==="break_logged").length;
  const meals  = rows.filter(e=>e.event_type==="meal_logged").length;
  const en = rows.filter(e=>e.event_type==="energy_checkin"&&e.numeric_value!=null).map(e=>Number(e.numeric_value));
  const energyStart = en.length?en[0]:null, energyEnd = en.length?en[en.length-1]:null;
  const energyDrop = energyStart!=null&&energyEnd!=null?Math.max(0,energyStart-energyEnd):0;
  let longest=0, run=0;
  for (const e of rows) {
    if (e.event_type==="study_completed") { run+=Number(e.numeric_value??0); longest=Math.max(longest,run); }
    else if (e.event_type==="break_logged") run=0;
  }
  const factors: {label:string;points:number}[]=[];
  const add=(l:string,p:number)=>{ if(p>0) factors.push({label:l,points:Math.round(p)}); };
  const sleep = checkin.sleep_hours!=null?Number(checkin.sleep_hours):8;
  add(`${sleep}h of sleep`, Math.min(25, Math.max(0,8-sleep)*8));
  add(`Energy fell ${energyDrop.toFixed(1)} points across the day`, Math.min(25, energyDrop*6));
  add(`${Math.round(longest)} min of study without a break`, Math.min(20,(Math.max(0,longest-90)/30)*7));
  const missed=Math.max(0,3-meals);
  add(missed===1?"Missed a meal":`Missed ${missed} meals`, missed*5);
  add(`${Math.round(studyMinutes)} min of study logged`, Math.min(15,(Math.max(0,studyMinutes-240)/60)*5));
  if (baseline?.base_energy!=null && energyEnd!=null) {
    const below=Math.max(0,Number(baseline.base_energy)-energyEnd);
    add(`Ending ${below.toFixed(1)} below your 30-day average energy`, Math.min(15, below*5));
  }
  if (breaks===0 && studyMinutes>60) add("No breaks logged today", 10);
  const score=Math.max(0,Math.min(100,Math.round(factors.reduce((s,f)=>s+f.points,0))));
  const level=score<30?"low":score<60?"moderate":score<80?"elevated":"high";
  factors.sort((a,b)=>b.points-a.points);
  return { score, level, factors, stats:{ studyMinutes:Math.round(studyMinutes), breaks, meals,
    longestStretchMin:Math.round(longest), energyStart, energyEnd, energyDrop:Number(energyDrop.toFixed(1)) } };
}
export function buildGeminiContext(r:any, c:any, b?:any) {
  return { strain_score:r.score, strain_level:r.level,
    scale_note:"0-100 strain. HIGHER means more depleted. This student is at "+r.score+" which is "+r.level+" strain.",
    contributing_factors:r.factors.map((f:any)=>f.label), today:r.stats,
    personal_baseline:b??null, tasks_the_student_listed:c.tasks_text??"" };
}
