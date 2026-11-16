"use client";
// PulseU hi-fi prototype (Milestone 3, Round 2).
// Runs entirely on demo data: no login, database, or AI calls, so nothing can break mid-session.
// Round 1 fixes are marked with "R1 FIX" comments.
import { useState } from "react";

const D = "font-[family-name:var(--font-display)]";
const M = "font-[family-name:var(--font-mono)]";
const S = "font-[family-name:var(--font-sans)]";
const TEAL = "#2DD4BF";

type Screen = "checkin" | "tasks" | "today" | "endday" | "calc" | "plan" | "confirmed" | "week" | "settings";
type Priority = "High" | "Medium" | "Low";
type Task = { id: number; name: string; fixed: boolean; when?: string; due: string; priority: Priority; repeats?: string };
type Decision = { choice: "accept" | "keep" | "custom" | "skip"; time?: string };
type PlanItem = {
  id: string; taskId: number; name: string; minutes: number; reason: string;
  kind: "tonight" | "move"; suggested?: string; options?: string[];
};

const INITIAL_TASKS: Task[] = [
  { id: 1, name: "Finance 3320", fixed: true, when: "Tue 9:30 AM", due: "Class", priority: "High", repeats: "Repeats Tue & Thu" },
  { id: 2, name: "Work shift", fixed: true, when: "Tue 5–9 PM", due: "Work", priority: "High", repeats: "Repeats Mon & Tue" },
  { id: 3, name: "Finish club promo video", fixed: false, due: "Tomorrow 9:00 AM", priority: "High" },
  { id: 4, name: "Chem lab write-up", fixed: false, due: "Thu 11:59 PM", priority: "Medium" },
  { id: 5, name: "Gym", fixed: false, due: "No deadline", priority: "Low" },
];

const PLAN: PlanItem[] = [
  { id: "video", taskId: 3, name: "Finish club promo video", minutes: 60, kind: "tonight",
    reason: "Due tomorrow at 9:00 AM, before the club event. It's the only thing due before Thursday." },
  { id: "chem", taskId: 4, name: "Chem lab write-up", minutes: 90, kind: "move",
    reason: "Not due until Thursday, so it can wait a day.",
    suggested: "Tue 1:30 PM", options: ["Tue 11:00 AM", "Tue 1:30 PM", "Wed 10:00 AM", "Wed 3:00 PM"] },
  { id: "gym", taskId: 5, name: "Gym", minutes: 60, kind: "move",
    reason: "No deadline. You slept 5 h, so PulseU won't suggest anything before 9 AM tomorrow.",
    suggested: "Tue 3:30 PM", options: ["Tue 7:00 AM", "Tue 11:00 AM", "Tue 3:30 PM", "Wed 6:00 PM"] },
];

const DAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4 };
function timeKey(t: string) {
  const m = t.match(/^(\w{3}) (\d{1,2}):(\d{2}) (AM|PM)/);
  if (!m) return 99999;
  let h = Number(m[2]) % 12;
  if (m[4] === "PM") h += 12;
  return (DAYS[m[1]] ?? 9) * 1440 + h * 60 + Number(m[3]);
}

const Label = ({ children }: { children: React.ReactNode }) =>
  <span className={`${M} text-[10px] uppercase tracking-[0.18em] text-[#6B7280]`}>{children}</span>;

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) =>
  <section className={`rounded-2xl border border-[#1A2025] bg-[#0F1418]/80 p-5 flex flex-col gap-4 ${className}`}>{children}</section>;

const Primary = ({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) =>
  <button onClick={onClick} disabled={disabled}
    className="w-full rounded-full bg-[#2DD4BF] text-[#06231F] py-3.5 text-[15px] font-semibold hover:bg-[#5EEAD4] disabled:opacity-40 transition-colors">
    {children}</button>;

const Secondary = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) =>
  <button onClick={onClick}
    className="w-full rounded-full border border-[#2DD4BF]/50 text-[#5EEAD4] py-3 text-[14px] font-medium hover:bg-[#2DD4BF]/10 transition-colors">
    {children}</button>;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-[14px] transition-colors ${active
        ? "border-[#2DD4BF] bg-[#2DD4BF]/15 text-white"
        : "border-[#222A31] bg-[#090B0D] text-[#C3CAD3] hover:border-[#2DD4BF]/40"}`}>
      {children}</button>);
}

const PRIORITY_COLOR: Record<Priority, string> = { High: "#F87171", Medium: "#FCD34D", Low: "#5EEAD4" };

export default function Demo() {
  const [screen, setScreen] = useState<Screen>("checkin");
  const [energyMorning, setEnergyMorning] = useState<number | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [sleepEditing, setSleepEditing] = useState(false);
  const [sleepText, setSleepText] = useState("5 h 10 m");
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [newTask, setNewTask] = useState({ name: "", fixed: false, due: "This week", priority: "Medium" as Priority });
  const [meals, setMeals] = useState(1);
  const [studyTaps, setStudyTaps] = useState(4);
  const [breakTaps, setBreakTaps] = useState(0);
  const [energyNow, setEnergyNow] = useState(2);
  const [pickingEnergy, setPickingEnergy] = useState(false);
  const [middayOn, setMiddayOn] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [picker, setPicker] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 1800); }
  function go(s: Screen) { setScreen(s); setPicker(null); window.scrollTo({ top: 0 }); }
  function reset() {
    setScreen("checkin"); setEnergyMorning(null); setMood(null); setSleepEditing(false); setSleepText("5 h 10 m");
    setTasks(INITIAL_TASKS); setMeals(1); setStudyTaps(4); setBreakTaps(0); setEnergyNow(2);
    setMiddayOn(false); setDecisions({}); setPicker(null);
  }

  // ---- Score: fixed formula, demo-day data. Default = 72. ----
  const missed = Math.max(0, 3 - meals);
  const below = Math.max(0, 3.4 - energyNow);
  const factors = [
    { key: "sleep", label: "Slept 5 h 10 m (you usually get 7 h)", points: 23,
      source: "Imported from your phone's sleep data this morning" },
    { key: "stretch", label: "2 h 30 m of studying with no break", points: breakTaps > 0 ? 0 : 20,
      source: "From your Studied taps at 12:00 and 2:30 PM, with no Break tap in between" },
    { key: "load", label: "5 h of studying total", points: 12,
      source: `Added up from your ${studyTaps} Studied taps today` },
    { key: "meals", label: missed === 0 ? "No missed meals" : missed === 1 ? "Missed 1 meal" : `Missed ${missed} meals`, points: Math.min(15, missed * 5),
      source: `You tapped Ate ${meals} time${meals === 1 ? "" : "s"} today. PulseU expects 3 meals a day.`, fixable: missed > 0 },
    { key: "energy", label: `Energy ended ${below.toFixed(1)} below your average`, points: Math.min(15, Math.round(below * 5)),
      source: `Your last Energy tap was ${energyNow}/5. Your 30-day average is 3.4.` },
  ].filter(f => f.points > 0).sort((a, b) => b.points - a.points);
  const score = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  const level = score >= 60 ? { label: "High strain", color: "#F87171" }
    : score >= 35 ? { label: "Moderate strain", color: "#FCD34D" } : { label: "Low strain", color: "#5EEAD4" };

  // ---- Plan derived from tasks + decisions ----
  const planItems = PLAN.filter(p => { const t = tasks.find(x => x.id === p.taskId); return t && !t.fixed; });
  const lockedTasks = tasks.filter(t => t.fixed);
  const extraTasks = tasks.filter(t => !t.fixed && !PLAN.some(p => p.taskId === t.id));

  const tonight: { name: string; minutes?: number }[] = [];
  const tomorrow: { name: string; time: string; locked?: boolean }[] = [
    { name: "Finance 3320", time: "Tue 9:30 AM", locked: true },
    { name: "Work shift", time: "Tue 5:00 PM", locked: true },
  ];
  const skipped: string[] = [];
  for (const p of planItems) {
    const d = decisions[p.id];
    if (p.kind === "tonight") {
      if (d?.choice === "skip") skipped.push(p.name); else tonight.push({ name: p.name, minutes: p.minutes });
    } else {
      if (!d || d.choice === "keep") tonight.push({ name: p.name, minutes: p.minutes });
      else tomorrow.push({ name: p.name, time: d.choice === "custom" ? d.time! : p.suggested! });
    }
  }
  tomorrow.sort((a, b) => timeKey(a.time) - timeKey(b.time));
  const tonightMinutes = tonight.reduce((s, t) => s + (t.minutes ?? 0), 0);

  const showNav = screen === "today" || screen === "week" || screen === "settings";

  return (
    <main className={`${S} min-h-screen text-[#E6E9ED]`}
      style={{ background: "radial-gradient(120% 80% at 50% 0%, #131A1E 0%, #090B0D 55%)" }}>
      <div className={`mx-auto max-w-[430px] px-5 pt-8 ${showNav ? "pb-28" : "pb-10"} flex flex-col gap-5`}>

        <header className="flex items-center justify-between">
          <span className={`${D} text-[22px] tracking-tight`}>PulseU</span>
          <Label>Mon · demo day</Label>
        </header>

        {/* L1 · MORNING CHECK-IN */}
        {screen === "checkin" && (<>
          <div>
            <h1 className={`${D} text-[30px] leading-tight`}>Good morning</h1>
            <p className="text-[14px] text-[#7C8592] mt-1">3 taps and you&apos;re done.</p>
          </div>

          {/* R1 FIX (P1, T1): make it obvious sleep is already filled in, nothing to type */}
          <Card>
            <Label>Sleep</Label>
            {!sleepEditing ? (
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className={`${D} text-[36px] leading-none tabular-nums`}>{sleepText}</span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-[#5EEAD4]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF]" />
                    Already imported from your phone. Nothing to type.
                  </span>
                </div>
                <button onClick={() => setSleepEditing(true)} className="text-[13px] text-[#7C8592] underline underline-offset-4 hover:text-white">
                  Not right? Edit</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={sleepText} onChange={e => setSleepText(e.target.value)}
                  className="flex-1 rounded-xl bg-[#090B0D] border border-[#222A31] px-4 py-2.5 text-[16px] outline-none focus:border-[#2DD4BF]" />
                <button onClick={() => setSleepEditing(false)} className="rounded-xl bg-[#2DD4BF] text-[#06231F] px-4 text-[14px] font-semibold">Save</button>
              </div>
            )}
          </Card>

          <Card>
            <Label>Energy right now</Label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(n => <Chip key={n} active={energyMorning === n} onClick={() => setEnergyMorning(n)}>{n}</Chip>)}
            </div>
            <div className="flex justify-between text-[11px] text-[#5A636F]"><span>drained</span><span>great</span></div>
          </Card>

          <Card>
            <Label>Mood (optional)</Label>
            <div className="grid grid-cols-3 gap-2">
              {["low", "okay", "good"].map(m => <Chip key={m} active={mood === m} onClick={() => setMood(mood === m ? null : m)}>{m}</Chip>)}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <Label>Today&apos;s tasks</Label>
              <span className="text-[12px] text-[#5A636F]">{tasks.length} on your list</span>
            </div>
            <button onClick={() => go("tasks")} className="text-left text-[15px] text-[#5EEAD4] hover:text-white">+ add or review tasks</button>
          </Card>

          <Primary onClick={() => go("today")}>Start my day</Primary>
        </>)}

        {/* L2 · TASKS */}
        {screen === "tasks" && (<>
          <div>
            <h1 className={`${D} text-[28px] leading-tight`}>What&apos;s on your plate?</h1>
            <p className="text-[14px] text-[#7C8592] mt-1">Add a due date and priority so PulseU knows what can wait.</p>
          </div>

          {/* R1 FIX (P2, T1): add tasks with due date + priority + fixed/flexible */}
          <Card>
            <input value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })}
              placeholder="Type a task…"
              className="rounded-xl bg-[#090B0D] border border-[#222A31] px-4 py-3 text-[15px] outline-none focus:border-[#2DD4BF] placeholder:text-[#4B5563]" />
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5"><Label>Due</Label>
                <select value={newTask.due} onChange={e => setNewTask({ ...newTask, due: e.target.value })}
                  className="rounded-xl bg-[#090B0D] border border-[#222A31] px-3 py-2.5 text-[14px]">
                  {["Tonight", "Tomorrow", "This week", "Next week", "No deadline"].map(o => <option key={o}>{o}</option>)}
                </select></label>
              <label className="flex flex-col gap-1.5"><Label>Priority</Label>
                <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value as Priority })}
                  className="rounded-xl bg-[#090B0D] border border-[#222A31] px-3 py-2.5 text-[14px]">
                  {["High", "Medium", "Low"].map(o => <option key={o}>{o}</option>)}
                </select></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Chip active={!newTask.fixed} onClick={() => setNewTask({ ...newTask, fixed: false })}>↔ Flexible</Chip>
              <Chip active={newTask.fixed} onClick={() => setNewTask({ ...newTask, fixed: true })}>🔒 Fixed</Chip>
            </div>
            <button disabled={!newTask.name.trim()}
              onClick={() => {
                setTasks([...tasks, { id: Date.now(), name: newTask.name.trim(), fixed: newTask.fixed, due: newTask.due, priority: newTask.priority }]);
                setNewTask({ name: "", fixed: false, due: "This week", priority: "Medium" });
                flash("Task added");
              }}
              className="rounded-xl border border-[#2DD4BF]/50 text-[#5EEAD4] py-2.5 text-[14px] font-medium disabled:opacity-30">
              + Add task</button>
          </Card>

          <div className="flex flex-col gap-2">
            {tasks.map(t => (
              <div key={t.id} className="rounded-2xl border border-[#1A2025] bg-[#0F1418]/80 p-4 flex items-center gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-[15px]">{t.name}</span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#7C8592]">
                    {t.fixed ? <span>{t.when ?? "Fixed time"}</span> : <span>Due: {t.due}</span>}
                    {!t.fixed && <span style={{ color: PRIORITY_COLOR[t.priority] }}>● {t.priority} priority</span>}
                    {/* R1 FIX (P2, T1): show that classes/work are saved and repeat */}
                    {t.repeats && <span className="text-[#5EEAD4]">↻ {t.repeats} · saved</span>}
                  </div>
                </div>
                {/* R1 FIX (P2, T1): lock is a large labeled toggle instead of a small icon */}
                <button onClick={() => setTasks(tasks.map(x => x.id === t.id ? { ...x, fixed: !x.fixed } : x))}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium border transition-colors ${t.fixed
                    ? "border-[#2DD4BF] bg-[#2DD4BF]/15 text-[#5EEAD4]" : "border-[#2C343C] text-[#9AA3AE]"}`}>
                  {t.fixed ? "🔒 Fixed" : "↔ Flexible"}</button>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-[#7C8592]">🔒 Fixed = PulseU will never suggest moving it. Tap the button on any task to switch.</p>
          <Primary onClick={() => go("today")}>Done</Primary>
        </>)}

        {/* L3 · TODAY */}
        {screen === "today" && (<>
          <h1 className={`${D} text-[28px] leading-tight`}>Today</h1>
          <Card>
            <Label>Today vs your normal</Label>
            <div className="flex items-end gap-8">
              <div className="flex flex-col gap-1.5">
                <span className={`${D} text-[52px] leading-[0.85] tabular-nums text-[#FB923C]`}>{energyNow}</span>
                <Label>energy now</Label>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={`${D} text-[52px] leading-[0.85] tabular-nums text-[#3F4854]`}>3.4</span>
                <Label>your 30-day avg</Label>
              </div>
            </div>
          </Card>

          <Card>
            <Label>Quick log</Label>
            <div className="grid grid-cols-2 gap-2">
              <Chip active={false} onClick={() => { setStudyTaps(studyTaps + 1); flash("Logged: studied"); }}>📚 Studied</Chip>
              <Chip active={false} onClick={() => { setBreakTaps(breakTaps + 1); flash("Logged: break"); }}>☕ Break</Chip>
              <Chip active={false} onClick={() => { setMeals(meals + 1); flash("Logged: ate"); }}>🍽 Ate</Chip>
              <Chip active={pickingEnergy} onClick={() => setPickingEnergy(!pickingEnergy)}>⚡ Energy</Chip>
            </div>
            {pickingEnergy && (
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(n => <Chip key={n} active={energyNow === n}
                  onClick={() => { setEnergyNow(n); setPickingEnergy(false); flash(`Logged: energy ${n}/5`); }}>{n}</Chip>)}
              </div>
            )}
            <span className={`${M} text-[12px] text-[#7C8592]`}>
              Studied 5 h · {breakTaps} break{breakTaps === 1 ? "" : "s"} · {meals} meal{meals === 1 ? "" : "s"}
            </span>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] text-[#C3CAD3]">🔔 Midday check-in is {middayOn ? "on" : "off"}</span>
              <button onClick={() => setMiddayOn(!middayOn)} className="text-[13px] text-[#5EEAD4] underline underline-offset-4">
                {middayOn ? "Turn off" : "Turn on"}</button>
            </div>
            <span className="text-[12px] text-[#5A636F]">At most 1 optional prompt per day.</span>
          </Card>

          <Primary onClick={() => go("endday")}>End my day</Primary>
        </>)}

        {/* L4 · END OF DAY */}
        {screen === "endday" && (<>
          <div>
            <h1 className={`${D} text-[28px] leading-tight`}>How today went</h1>
            <p className="text-[14px] text-[#7C8592] mt-1">Here&apos;s what made today harder than usual:</p>
          </div>

          {/* R1 FIX (P1 T2, P1+P2 debrief): each factor says where its data came from, and shows its points */}
          <div className="flex flex-col gap-2">
            {factors.map(f => (
              <div key={f.key} className="rounded-2xl border border-[#1A2025] bg-[#0F1418]/80 p-4 flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px]">{f.label}</span>
                  <span className={`${M} text-[12px] text-[#F87171] tabular-nums whitespace-nowrap`}>+{f.points} pts</span>
                </div>
                <span className="text-[12px] text-[#7C8592] leading-[1.5]">ⓘ {f.source}</span>
                {"fixable" in f && f.fixable && (
                  <button onClick={() => { setMeals(meals + 1); flash("Meal added, score updated"); }}
                    className="self-start text-[12px] text-[#5EEAD4] underline underline-offset-4">I ate but didn&apos;t log it</button>
                )}
              </div>
            ))}
          </div>

          <Card>
            <Label>Strain today</Label>
            <div className="flex items-end gap-4">
              <span className={`${D} text-[80px] leading-[0.75] tabular-nums`} style={{ color: level.color }}>{score}</span>
              <div className="flex flex-col gap-1 pb-1">
                <span className="text-[13px] text-[#7C8592]">/100 ·</span>
                <span className={`${D} text-[20px] leading-none`} style={{ color: level.color }}>{level.label}</span>
              </div>
            </div>
            <span className="text-[13px] text-[#C3CAD3]">Higher = more drained</span>
            <div className="flex flex-col gap-1.5">
              <div className="relative h-2 rounded-full" style={{ background: "linear-gradient(90deg,#5EEAD4,#FCD34D,#F87171)" }}>
                <div className="absolute -top-1 w-4 h-4 rounded-full border-2 border-[#0F1418] bg-white" style={{ left: `calc(${score}% - 8px)` }} />
              </div>
              <div className="flex justify-between text-[11px] text-[#5A636F]"><span>calm</span><span>drained</span></div>
            </div>
          </Card>

          {/* R1 FIX (P2, T2): "How is this calculated?" is now a visible button, not a small link */}
          <Secondary onClick={() => go("calc")}>How is {score} calculated?</Secondary>
          <Primary onClick={() => go("plan")}>See tonight&apos;s plan</Primary>
          <button onClick={() => go("today")} className="text-[13px] text-[#5A636F] hover:text-white py-1">← Back to today</button>
        </>)}

        {/* L5 · HOW IT'S CALCULATED */}
        {screen === "calc" && (<>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className={`${D} text-[28px] leading-tight`}>How your score works</h1>
              <p className="text-[14px] text-[#7C8592] mt-1">A fixed formula. AI never changes the number.</p>
            </div>
            <button onClick={() => go("endday")} className="text-[22px] text-[#7C8592] hover:text-white leading-none">✕</button>
          </div>

          <Card>
            <div className="flex justify-between"><Label>Factor</Label><Label>You today / max</Label></div>
            {[
              { name: "Sleep below 8 h", rule: "8 pts per hour short", you: 23, max: 25 },
              { name: "Long study with no break", rule: "7 pts per 30 min past 1 h without a break", you: breakTaps > 0 ? 0 : 20, max: 20 },
              { name: "Total study load", rule: "6 pts per hour past 3 h", you: 12, max: 15 },
              { name: "Below your 30-day energy", rule: "5 pts per point below your average", you: Math.min(15, Math.round(below * 5)), max: 15 },
              { name: "Missed meals", rule: "5 pts each (expects 3 a day)", you: Math.min(15, missed * 5), max: 15 },
            ].map(r => (
              <div key={r.name} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px]">{r.name}</span>
                  <span className={`${M} text-[12px] tabular-nums`}><span className="text-white">{r.you}</span><span className="text-[#5A636F]"> / {r.max}</span></span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1A2025] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(r.you / r.max) * 100}%`, background: TEAL }} />
                </div>
                <span className="text-[12px] text-[#5A636F]">{r.rule}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t border-[#1A2025]">
              <span className="text-[14px] font-semibold">Total</span>
              <span className={`${M} text-[13px]`}>{score} / 100</span>
            </div>
          </Card>

          <Card>
            <Label>You vs general guideline</Label>
            <div className="flex flex-col gap-2 text-[13px] text-[#C3CAD3]">
              <span>Sleep: you 5 h 10 m · your avg 7 h · guideline 7–9 h (adults)</span>
              <span>Meals: you {meals} · guideline 3 regular meals</span>
              <span>Breaks: you {breakTaps} · guideline a short break every 60–90 min of focus</span>
            </div>
          </Card>
          <p className="text-[13px] text-[#7C8592]">AI only writes the explanation and suggests a plan.</p>
          <Primary onClick={() => go("endday")}>Back to my day</Primary>
        </>)}

        {/* L6 · TONIGHT'S PLAN */}
        {screen === "plan" && (<>
          <div>
            <h1 className={`${D} text-[28px] leading-tight`}>Suggested plan</h1>
            <p className="text-[14px] text-[#7C8592] mt-1">Nothing changes until you choose. Anything you don&apos;t choose stays as it is.</p>
          </div>

          {planItems.map(p => {
            const t = tasks.find(x => x.id === p.taskId)!;
            const d = decisions[p.id];
            const set = (dec: Decision) => { setDecisions({ ...decisions, [p.id]: dec }); setPicker(null); };
            return (
              <Card key={p.id}>
                <div className="flex items-center justify-between">
                  <Label>{p.kind === "tonight" ? "Do tonight" : "Move to tomorrow?"}</Label>
                  <span className="text-[12px]" style={{ color: PRIORITY_COLOR[t.priority] }}>● {t.priority}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[16px]">{p.name} · {p.minutes} m</span>
                  {/* R1 FIX (P2, T3): show the deadline and the reason on every suggestion */}
                  <span className="text-[13px] text-[#FCD34D]">⏰ Due: {t.due}</span>
                  <span className="text-[13px] text-[#7C8592] leading-[1.5]">{p.reason}</span>
                </div>

                {p.kind === "tonight" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Chip active={d?.choice === "accept"} onClick={() => set({ choice: "accept" })}>✓ Do it tonight</Chip>
                    <Chip active={d?.choice === "skip"} onClick={() => set({ choice: "skip" })}>✕ Skip tonight</Chip>
                  </div>
                ) : (<>
                  {/* R1 FIX (P1, T3): clearer labels + choose your own time */}
                  <div className="grid grid-cols-2 gap-2">
                    <Chip active={d?.choice === "accept"} onClick={() => set({ choice: "accept" })}>✓ Move to {p.suggested}</Chip>
                    <Chip active={d?.choice === "keep"} onClick={() => set({ choice: "keep" })}>Keep tonight</Chip>
                  </div>
                  <Chip active={d?.choice === "custom" || picker === p.id} onClick={() => setPicker(picker === p.id ? null : p.id)}>
                    🕒 {d?.choice === "custom" ? `Moved to ${d.time} · change` : "Pick another time"}</Chip>
                  {picker === p.id && (
                    <div className="grid grid-cols-2 gap-2">
                      {p.options!.map(o => <Chip key={o} active={d?.time === o} onClick={() => set({ choice: "custom", time: o })}>{o}</Chip>)}
                    </div>
                  )}
                </>)}
              </Card>);
          })}

          {extraTasks.length > 0 && (
            <Card>
              <Label>Also on your list (not moved)</Label>
              {extraTasks.map(t => <span key={t.id} className="text-[14px] text-[#C3CAD3]">{t.name} · due {t.due}</span>)}
            </Card>
          )}

          <Card>
            <Label>🔒 Won&apos;t move</Label>
            {lockedTasks.map(t => <span key={t.id} className="text-[14px] text-[#C3CAD3]">{t.name}{t.when ? ` · ${t.when}` : ""}</span>)}
          </Card>

          <Card>
            <span className="text-[14px] text-[#C3CAD3] leading-[1.6]">🌙 Take a break after 45 m of editing · eat before 8 PM · stop by 11:00 PM</span>
          </Card>

          <Primary onClick={() => go("confirmed")}>Confirm plan</Primary>
          <button onClick={() => go("endday")} className="text-[13px] text-[#5A636F] hover:text-white py-1">← Back</button>
        </>)}

        {/* L7 · CONFIRMED */}
        {screen === "confirmed" && (<>
          <h1 className={`${D} text-[30px] leading-tight`}>You&apos;re set</h1>
          <Card>
            <div className="flex justify-between"><Label>Tonight</Label><span className={`${M} text-[11px] text-[#5A636F]`}>{tonightMinutes} m total</span></div>
            {tonight.length === 0 && <span className="text-[14px] text-[#7C8592]">Nothing. Rest tonight.</span>}
            {tonight.map(t => <span key={t.name} className="text-[15px]">{t.name}{t.minutes ? ` · ${t.minutes} m` : ""}</span>)}
            <span className="text-[14px] text-[#7C8592]">Break · eat by 8 PM</span>
          </Card>
          <Card>
            <Label>Tomorrow</Label>
            {tomorrow.map(t => (
              <div key={t.name} className="flex justify-between gap-3 text-[15px]">
                <span>{t.name}{t.locked ? " 🔒" : ""}</span>
                <span className={`${M} text-[12px] text-[#7C8592] whitespace-nowrap`}>{t.name === "Work shift" ? "5–9 PM" : t.time.replace(/^\w{3} /, "")}</span>
              </div>))}
          </Card>
          {skipped.length > 0 && (
            <Card><Label>Skipped</Label>{skipped.map(s => <span key={s} className="text-[14px] text-[#7C8592]">{s}</span>)}</Card>
          )}
          <Card className="items-center text-center">
            <Label>Stop schoolwork by</Label>
            <span className={`${D} text-[40px] leading-none tabular-nums`}>11:00 PM</span>
          </Card>
          <Primary onClick={() => go("today")}>Back to today</Primary>
        </>)}

        {/* L8 · WEEK */}
        {screen === "week" && (<>
          <div>
            <h1 className={`${D} text-[28px] leading-tight`}>Your week</h1>
            <p className="text-[14px] text-[#7C8592] mt-1">Since you started using PulseU</p>
          </div>
          <Card>
            <Label>Rest gained</Label>
            <span className={`${D} text-[44px] leading-none text-[#5EEAD4]`}>+2 h 15 m</span>
            <span className="text-[13px] text-[#7C8592]">From 6 break and stop-time suggestions you accepted</span>
          </Card>
          <Card>
            <Label>Average strain</Label>
            <div className="flex items-end gap-6">
              <div className="flex flex-col"><span className={`${D} text-[34px] leading-none text-[#5A636F]`}>68</span><span className="text-[12px] text-[#5A636F]">last week</span></div>
              <span className="text-[20px] text-[#5A636F] pb-3">→</span>
              <div className="flex flex-col"><span className={`${D} text-[34px] leading-none`}>54</span><span className="text-[12px] text-[#7C8592]">this week</span></div>
            </div>
            <div className="flex items-end gap-2 h-20 pt-2">
              {[{ d: "M", v: 72 }, { d: "T", v: 61 }, { d: "W", v: 49 }, { d: "T", v: 44 }, { d: "F", v: 52 }, { d: "S", v: 38 }, { d: "S", v: 41 }].map((x, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-md" style={{ height: `${x.v * 0.8}%`, background: x.v >= 60 ? "#F87171" : x.v >= 35 ? "#FCD34D" : "#5EEAD4", opacity: 0.8 }} />
                  <span className="text-[10px] text-[#5A636F]">{x.d}</span>
                </div>))}
            </div>
            <span className="text-[12px] text-[#5A636F]">Lower is better</span>
          </Card>
          <Card>
            <Label>Sleep</Label>
            <span className="text-[15px]">Avg 6 h 05 m <span className="text-[#5EEAD4]">(+40 m vs last week)</span></span>
          </Card>
          <p className="text-[13px] text-[#7C8592] text-center">No streaks, no badges. Just what changed.</p>
        </>)}

        {/* SETTINGS */}
        {screen === "settings" && (<>
          <h1 className={`${D} text-[28px] leading-tight`}>Settings</h1>
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-[14px]">Midday check-in (1 per day)</span>
              <button onClick={() => setMiddayOn(!middayOn)} className="text-[13px] text-[#5EEAD4] underline underline-offset-4">{middayOn ? "On" : "Off"}</button>
            </div>
          </Card>
          <Card>
            <span className="text-[13px] text-[#7C8592]">Facilitator only: reset everything before the next participant.</span>
            <button onClick={() => { reset(); flash("Demo reset"); }} className="rounded-full border border-[#F87171]/50 text-[#F87171] py-2.5 text-[14px]">Restart demo</button>
          </Card>
        </>)}
      </div>

      {showNav && (
        <nav className="fixed bottom-0 inset-x-0 border-t border-[#1A2025] bg-[#090B0D]/95 backdrop-blur">
          <div className="mx-auto max-w-[430px] grid grid-cols-3">
            {([["today", "Today"], ["week", "Week"], ["settings", "Settings"]] as [Screen, string][]).map(([s, l]) => (
              <button key={s} onClick={() => go(s)}
                className={`py-4 text-[13px] ${screen === s ? "text-[#5EEAD4]" : "text-[#7C8592]"}`}>{l}</button>))}
          </div>
        </nav>
      )}

      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 rounded-full bg-[#2DD4BF] text-[#06231F] px-4 py-2 text-[13px] font-semibold shadow-lg">{toast}</div>
      )}
    </main>);
}
