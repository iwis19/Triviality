import sqlite3, sys
c = sqlite3.connect('/home/ubuntu/norththehackers/backend/mathlab.db')
since = sys.argv[1] if len(sys.argv) > 1 else '2026-09-19 18:00'
print(c.execute("select status,count(*) from attempts group by status").fetchall())
print("running by role:", c.execute("select role,count(*) from attempts where status='running' group by role").fetchall())
print("problem status flags:", c.execute("select slug,status from problems where status not in ('reported_open') and slug like 'erdos%'").fetchall())
print("\n-- new lean_verified / proof candidates since", since)
for r in c.execute("""select pr.slug, i.evidence_status, i.title from ideas i join campaigns ca on i.campaign_id=ca.id
 join problems pr on ca.problem_id=pr.id where i.created_at > ? and i.evidence_status in ('lean_verified','informal_proof_candidate','counterexample_checked')
 order by i.created_at""", (since,)):
    print(r)
print("\n-- evidence since", since)
for r in c.execute("""select pr.slug, e.check_type, e.result, e.certified, substr(e.summary,1,160) from evidence e join problems pr on e.problem_id=pr.id
 where e.created_at > ? and (e.check_type in ('lean_attempt','literature_check') or e.result in ('refutes','counterexample')) order by e.created_at""", (since,)):
    print(r)
