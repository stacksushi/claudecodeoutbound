# Creates a DRAFT Smartlead campaign from a sequences.json + leads.json. Never attaches inboxes, never starts.
# Usage: python3 smartlead_draft.py --sequences sequences.json --leads leads.json --name "..." [--dry]
import json, sys, os, re, time, urllib.request, urllib.error
a=sys.argv; g=lambda f,d=None: a[a.index(f)+1] if f in a else d
KEY=os.environ.get("SMARTLEAD_API_KEY") or os.environ.get("SMARTLEADS_API_KEY") or sys.exit("missing SMARTLEAD_API_KEY"); API="https://server.smartlead.ai/api/v1"
leads=json.load(open(g("--leads"))); name=g("--name"); dry="--dry" in a
def call(method,path,body=None):
    url=f"{API}{path}{'&' if '?' in path else '?'}api_key={KEY}"
    for i in range(4):
        req=urllib.request.Request(url,method=method,data=json.dumps(body).encode() if body is not None else None,headers={"Content-Type":"application/json"})
        try: return json.load(urllib.request.urlopen(req,timeout=60))
        except urllib.error.HTTPError as e:
            if e.code in (429,500,502,503): time.sleep(2**i); continue
            raise SystemExit(f"{method} {path} -> {e.code}: {e.read().decode()[:300]}")
payload=json.load(open(g("--sequences")))
for s in payload:
    for v in s["seq_variants"]:
        assert v["email_body"].count("{")==v["email_body"].count("}"), "unbalanced braces"
if dry: print(json.dumps(payload)[:600]); sys.exit()
existing=call("GET","/campaigns/")
if any(c.get("name")==name for c in (existing if isinstance(existing,list) else existing.get("data",[]))): raise SystemExit("campaign name already exists; refusing to duplicate")
cid=call("POST","/campaigns/create",{"name":name}); cid=cid.get("id") or cid.get("campaign_id"); print("campaign",cid)
call("POST",f"/campaigns/{cid}/sequences",{"sequences":payload}); print("sequences saved")
r=call("POST",f"/campaigns/{cid}/leads",{"lead_list":leads}); print("leads",json.dumps(r)[:200])
call("POST",f"/campaigns/{cid}/settings",{"track_settings":["DONT_TRACK_EMAIL_OPEN","DONT_TRACK_LINK_CLICK"],"stop_lead_settings":"REPLY_TO_AN_EMAIL","send_as_plain_text":True,"enable_ai_esp_matching":False}); print("settings saved")
call("POST",f"/campaigns/{cid}/schedule",{"timezone":"America/New_York","days_of_the_week":[1,2,3,4,5],"start_hour":"08:00","end_hour":"17:00","min_time_btw_emails":10,"max_new_leads_per_day":30}); print("schedule saved")
print(f"DRAFT, no inboxes attached, not started: https://app.smartlead.ai/app/email-campaign/{cid}")
