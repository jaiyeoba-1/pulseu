import os, random, sys
from datetime import datetime, timedelta, timezone
import psycopg
DAYS=30; random.seed(7)
def build_day(uid, day, wd):
    ev=[]; rough=random.random()<0.25; light=wd>=5
    e0=random.uniform(4.0,6.5) if rough else random.uniform(6.0,8.5)
    dec=random.uniform(2.0,3.5) if rough else random.uniform(0.8,2.0)
    hrs=[8,11,14,17,20]
    for i,h in enumerate(hrs):
        p=i/(len(hrs)-1); en=max(1.0,min(10.0,e0-dec*p+random.uniform(-0.4,0.4)))
        ev.append((day+timedelta(hours=h,minutes=random.randint(0,45)),uid,"energy_checkin",round(en,1)))
    blocks=1 if light else (4 if rough else random.randint(2,3)); h=9
    for _ in range(blocks):
        m=random.choice([45,60,75,90,120]); s=day+timedelta(hours=h,minutes=random.randint(0,30))
        ev.append((s,uid,"study_started",None)); ev.append((s+timedelta(minutes=m),uid,"study_completed",m)); h+=m//60+2
    for _ in range(0 if rough else random.randint(1,3)):
        ev.append((day+timedelta(hours=random.randint(10,19),minutes=random.randint(0,59)),uid,"break_logged",random.choice([10,15,20,30])))
    meals=[8,12,18]
    if rough: meals.remove(random.choice(meals))
    for h2 in meals: ev.append((day+timedelta(hours=h2,minutes=random.randint(0,40)),uid,"meal_logged",None))
    return ev, round(random.uniform(4.5,6.0) if rough else random.uniform(6.5,8.5),1), round(e0)
def main():
    aid=sys.argv[1] if len(sys.argv)>1 else "auth0|test-user-1"
    with psycopg.connect(os.environ["DATABASE_URL"]) as c, c.cursor() as cur:
        cur.execute("""INSERT INTO users (auth0_user_id,display_name) VALUES (%s,%s)
            ON CONFLICT (auth0_user_id) DO UPDATE SET display_name=EXCLUDED.display_name RETURNING id""",(aid,"Demo Student"))
        uid=cur.fetchone()[0]
        today=datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0)
        allev=[]; chk=[]
        for n in range(DAYS,0,-1):
            d=today-timedelta(days=n); e,s,en=build_day(uid,d,d.weekday()); allev+=e
            chk.append((uid,d.date(),s,en,random.randint(4,8)))
        cur.executemany("INSERT INTO student_events (time,user_id,event_type,numeric_value) VALUES (%s,%s,%s,%s)",allev)
        cur.executemany("""INSERT INTO daily_checkins (user_id,plan_date,sleep_hours,initial_energy,initial_mood)
            VALUES (%s,%s,%s,%s,%s) ON CONFLICT (user_id,plan_date) DO NOTHING""",chk)
        c.commit(); c.autocommit=True
        cur.execute("CALL refresh_continuous_aggregate('daily_stats',NULL,NULL)")
    print(f"seeded {len(allev)} events across {DAYS} days")
main()
