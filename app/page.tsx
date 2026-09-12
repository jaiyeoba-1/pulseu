"use client";
import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, CartesianGrid } from "recharts";

const D = "font-[family-name:var(--font-display)]";
const M = "font-[family-name:var(--font-mono)]";
const S = "font-[family-name:var(--font-sans)]";

const BANDS = [
  { key:"low",      label:"Low",      color:"#5EEAD4" },
  { key:"moderate", label:"Moderate", color:"#FCD34D" },
  { key:"elevated", label:"Elevated", color:"#FB923C" },
  { key:"high",     label:"High",     color:"#F87171" },
];
const bandOf = (l:string) => BANDS.find(b=>b.key===l) ?? BANDS[0];

const Label = ({children}:{children:any}) =>
  <span className={`${M} text-[10px] uppercase tracking-[0.18em] text-[#6B7280]`}>{children}</span>;

export default function Home() {
  const [checkin,setCheckin]=useState<any>(null);
  const [baseline,setBaseline]=useState<any>(null);
  const [today,setToday]=useState<any>(null);
  const [recovery,setRecovery]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  const [form,setForm]=useState({sleep_hours:"6.5",initial_energy:"7",initial_mood:"6",tasks_text:""});

  async function load() {
    const [c,b,t]=await Promise.all([
      fetch("/api/checkin").then(r=>r.json()).catch(()=>({})),
      fetch("/api/baseline").then(r=>r.json()).catch(()=>({})),
      fetch("/api/events").then(r=>r.json()).catch(()=>({}))]);
    setCheckin(c.checkin); setBaseline(b); setToday(t);
  }
  useEffect(()=>{load();},[]);

  async function submitCheckin(e:any){ e.preventDefault(); setBusy(true);
    await fetch("/api/checkin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    await load(); setBusy(false); }
  async function logEvent(t:string, v:any=null){ setBusy(true);
    await fetch("/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event_type:t,numeric_value:v})});
    await load(); setBusy(false); }
  async function endDay(){ setBusy(true);
    const r=await fetch("/api/recovery",{method:"POST"}).then(r=>r.json());
    setRecovery(r); setBusy(false); window.scrollTo({top:0,behavior:"smooth"}); }

  const cmp = baseline?.comparison;
  const delta = cmp?.energy_delta!=null ? Number(cmp.energy_delta) : null;
  const history = (baseline?.history ?? []).map((d:any)=>({
    day:new Date(d.day).toLocaleDateString(undefined,{month:"numeric",day:"numeric"}), energy:Number(d.avg_energy)}));
  const last = history[history.length-1];

  return (
    <main className={`${S} min-h-screen text-[#E6E9ED]`}
      style={{background:"radial-gradient(120% 80% at 50% 0%, #131A1E 0%, #090B0D 55%)"}}>
      <div className="mx-auto max-w-[680px] px-6 py-14 flex flex-col gap-6">

        <header className="flex items-end justify-between gap-4 pb-6 border-b border-[#1A2025]">
          <div>
            <h1 className={`${D} text-[42px] leading-none tracking-tight`}>PulseU</h1>
            <p className="text-[13px] text-[#7C8592] mt-2">Your evening, rebuilt around the day you actually had.</p>
          </div>
          {cmp?.days_of_history && <Label>{cmp.days_of_history}d baseline</Label>}
        </header>

        {!checkin && (
          <form onSubmit={submitCheckin} className="flex flex-col gap-6 rounded-2xl border border-[#1A2025] bg-[#0F1418]/80 p-7">
            <div>
              <h2 className={`${D} text-[26px] leading-tight`}>How did you start today?</h2>
              <p className="text-[13px] text-[#7C8592] mt-1.5">Ten seconds. No AI here — just what you already know.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[["sleep_hours","Slept"],["initial_energy","Energy"],["initial_mood","Mood"]].map(([k,l])=>(
                <label key={k} className="flex flex-col gap-2">
                  <Label>{l}</Label>
                  <input id={k} value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})}
                    className={`${D} rounded-xl bg-[#090B0D] border border-[#222A31] px-4 py-3 text-[28px] tabular-nums outline-none focus:border-[#2DD4BF] transition-colors`}/>
                </label>))}
            </div>
            <label className="flex flex-col gap-2">
              <Label>What&apos;s on your plate</Label>
              <textarea id="tasks_text" rows={3} value={form.tasks_text}
                onChange={e=>setForm({...form,tasks_text:e.target.value})}
                placeholder="finance exam review, chem lab writeup, gym, optional reading"
                className="rounded-xl bg-[#090B0D] border border-[#222A31] px-4 py-3 text-[15px] outline-none focus:border-[#2DD4BF] transition-colors resize-none placeholder:text-[#4B5563]"/>
            </label>
            <button disabled={busy}
              className="self-start rounded-full bg-[#2DD4BF] text-[#06231F] px-7 py-3 text-[15px] font-semibold hover:bg-[#5EEAD4] disabled:opacity-40 transition-colors">
              {busy?"Saving…":"Start my day"}</button>
          </form>)}

        {checkin && !recovery && (<>
          {cmp && (
            <section className="rounded-2xl border border-[#1A2025] bg-[#0F1418]/80 p-7 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <Label>Today vs your own normal</Label>
                {delta!=null && (
                  <span className={`${M} text-[10px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-full`}
                    style={{color:delta<0?"#FB923C":"#5EEAD4", background:delta<0?"#FB923C14":"#5EEAD414"}}>
                    {delta<0?"below":"above"} baseline</span>)}
              </div>
              <div className="flex items-end justify-between gap-6">
                <div className="flex items-end gap-9">
                  <div className="flex flex-col gap-2">
                    <span className={`${D} text-[58px] leading-[0.8] tabular-nums`}>{cmp.energy ?? "—"}</span>
                    <Label>energy today</Label>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className={`${D} text-[58px] leading-[0.8] tabular-nums text-[#3F4854]`}>{cmp.base_energy ?? "—"}</span>
                    <Label>30-day average</Label>
                  </div>
                </div>
                {delta!=null && (
                  <div className="flex flex-col gap-2 items-end">
                    <span className={`${D} text-[58px] leading-[0.8] tabular-nums`} style={{color:delta<0?"#FB923C":"#5EEAD4"}}>
                      {delta>0?"+":""}{delta.toFixed(1)}</span>
                    <Label>difference</Label>
                  </div>)}
              </div>
            </section>)}

          <section className="rounded-2xl border border-[#1A2025] bg-[#0F1418]/80 p-7 flex flex-col gap-5">
            <Label>Energy, last 30 days</Label>
            <div className="h-56 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{top:8,right:14,bottom:0,left:0}}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.26}/>
                    <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0}/>
                  </linearGradient></defs>
                  <CartesianGrid stroke="#161C21" vertical={false}/>
                  <XAxis dataKey="day" stroke="#2C343C" fontSize={10} tickLine={false} axisLine={false}
                    tick={{fill:"#5A636F",fontFamily:"var(--font-mono)"}} interval="preserveStartEnd" minTickGap={34}/>
                  <YAxis domain={[0,10]} ticks={[0,5,10]} fontSize={10} tickLine={false} axisLine={false}
                    width={22} tick={{fill:"#5A636F",fontFamily:"var(--font-mono)"}}/>
                  <Tooltip cursor={{stroke:"#3A434D",strokeWidth:1}}
                    contentStyle={{background:"#0F1418",border:"1px solid #222A31",borderRadius:10,fontSize:13,fontFamily:"var(--font-sans)"}}
                    labelStyle={{color:"#7C8592"}} itemStyle={{color:"#E6E9ED"}} formatter={(v:any)=>[v,"energy"]}/>
                  {cmp?.base_energy && <ReferenceLine y={Number(cmp.base_energy)} stroke="#3F4854" strokeDasharray="3 4"
                    label={{value:"your average",position:"insideTopRight",fill:"#5A636F",fontSize:10}}/>}
                  <Area type="monotone" dataKey="energy" stroke="#2DD4BF" strokeWidth={2} fill="url(#g)"/>
                  {last && <ReferenceDot x={last.day} y={last.energy} r={4} fill="#2DD4BF" stroke="#0F1418" strokeWidth={2}/>}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <Label>Log what&apos;s happening</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[["Studied 60m",()=>logEvent("study_completed",60)],
                ["Took a break",()=>logEvent("break_logged",15)],
                ["Ate",()=>logEvent("meal_logged")],
                ["Energy now",()=>{const v=prompt("Energy right now, 1-10?"); if(v) logEvent("energy_checkin",Number(v));}]
              ].map(([l,fn]:any)=>(
                <button key={l} disabled={busy} onClick={fn}
                  className="rounded-xl border border-[#222A31] bg-[#0F1418]/60 py-3.5 text-[14px] text-[#C3CAD3] hover:border-[#2DD4BF]/40 hover:text-white disabled:opacity-40 transition-colors">
                  {l}</button>))}
            </div>
            {today?.totals && (
              <div className={`${M} flex gap-6 text-[11px] text-[#5A636F] pt-1`}>
                <span>{today.totals.study_minutes}m studied</span>
                <span>{today.totals.breaks} breaks</span>
                <span>{today.totals.meals} meals</span>
              </div>)}
          </section>

          <button disabled={busy} onClick={endDay}
            className="rounded-full bg-[#2DD4BF] text-[#06231F] py-4 text-[16px] font-semibold hover:bg-[#5EEAD4] disabled:opacity-40 transition-colors mt-1">
            {busy?"Reading your day…":"End School Day"}</button>
        </>)}

        {recovery && (()=>{ const band=bandOf(recovery.score.level);
          const maxPts=Math.max(...recovery.score.factors.map((f:any)=>f.points),1);
          return (
          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[#1A2025] bg-[#0F1418]/80 p-8 flex flex-col gap-7">
              <div className="flex items-start gap-7">
                <span className={`${D} text-[92px] leading-[0.72] tabular-nums`} style={{color:band.color}}>
                  {recovery.score.score}</span>
                <div className="flex flex-col gap-1.5 pt-2">
                  <span className={`${D} text-[24px] leading-none`} style={{color:band.color}}>{band.label} strain</span>
                  <Label>higher means more depleted</Label>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex gap-1 h-1">
                  {BANDS.map(b=><div key={b.key} className="flex-1 rounded-full"
                    style={{background:b.color, opacity:b.key===recovery.score.level?1:0.16}}/>)}
                </div>
                <div className="flex justify-between">{BANDS.map(b=><Label key={b.key}>{b.label}</Label>)}</div>
              </div>

              {recovery.plan?.summary && (
                <p className="text-[16px] leading-[1.65] text-[#C3CAD3]">{recovery.plan.summary}</p>)}

              <div className="flex flex-col gap-3 pt-5 border-t border-[#1A2025]">
                <Label>What drove it</Label>
                {recovery.score.factors.map((f:any,i:number)=>(
                  <div key={i} className="flex items-center gap-3.5">
                    <div className="h-[3px] rounded-full" style={{width:`${(f.points/maxPts)*52}px`,background:band.color,opacity:0.65}}/>
                    <span className="text-[14px] text-[#C3CAD3] flex-1">{f.label}</span>
                    <span className={`${M} text-[11px] text-[#5A636F] tabular-nums`}>+{f.points}</span>
                  </div>))}
              </div>
            </div>

            {recovery.cached && <p className="text-[12px] text-[#FB923C] text-center">Showing your most recent plan — live generation unavailable.</p>}

            {recovery.plan && (<>
              <Card title="Finish tonight" accent="#5EEAD4">
                {recovery.plan.complete_tonight?.map((t:any,i:number)=><Row key={i} main={t.task} meta={`${t.duration_minutes}m`} sub={t.why}/>)}
              </Card>
              <Card title="Pushed to tomorrow" accent="#FB923C">
                {recovery.plan.reschedule?.map((t:any,i:number)=><Row key={i} main={t.task} sub={t.why}/>)}
              </Card>
              <Card title="Tomorrow, rebuilt">
                {recovery.plan.tomorrow_plan?.map((t:any,i:number)=><Row key={i} main={t.task} meta={`${t.suggested_time} · ${t.duration_minutes}m`}/>)}
              </Card>
              <Card title="Tonight">
                {recovery.plan.recovery_actions?.map((t:string,i:number)=><Row key={i} main={t}/>)}
              </Card>
              <div className="rounded-2xl border border-[#1A2025] bg-[#0F1418]/80 py-7 text-center flex flex-col gap-2">
                <Label>Stop schoolwork by</Label>
                <span className={`${D} text-[38px] leading-none tabular-nums`}>{recovery.plan.stop_time}</span>
              </div>
            </>)}
            <button onClick={()=>setRecovery(null)}
              className="text-[13px] text-[#5A636F] hover:text-[#C3CAD3] py-3 transition-colors">← back to today</button>
          </section>);})()}
      </div>
    </main>);
}

function Card({title,accent,children}:{title:string;accent?:string;children:any}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  if(!items || (Array.isArray(items) && items.length===0)) return null;
  return (
    <div className="rounded-2xl border border-[#1A2025] bg-[#0F1418]/80 p-7 flex flex-col gap-5">
      <div className="flex items-center gap-2.5">
        {accent && <span className="w-[3px] h-3 rounded-full" style={{background:accent}}/>}
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">{title}</span>
      </div>
      <div className="flex flex-col gap-4">{items}</div>
    </div>);
}

function Row({main,meta,sub}:{main:string;meta?:string;sub?:string}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[15px] text-[#E6E9ED]">{main}</span>
        {meta && <span className="font-[family-name:var(--font-mono)] text-[11px] text-[#5A636F] whitespace-nowrap tabular-nums">{meta}</span>}
      </div>
      {sub && <span className="text-[13px] text-[#7C8592] leading-[1.55]">{sub}</span>}
    </div>);
}