# Render-gate: renders FULL emails with REAL prospect rows and the real signature, then lints the renders.
# Usage: python3 render_lint.py payload.json prospects.json [N=40]
import json, re, random, sys, os
pay=json.load(open(sys.argv[1])); pros=json.load(open(sys.argv[2])); N=int(sys.argv[3]) if len(sys.argv)>3 else 40
VARS={"FIRST_NAME":"firstName","COMPANY":"company","STATE":"state","CUSTOM_1":"custom1"}
BANNED=r"\b(get|getting|bank|credit|access|open|compare|problem|now|billing|deal|finance|financial|claims|insurance|mortgage|soon|new|performance|freedom|home|sales|medical|urgent|life|marketing|investment|diagnostics|friend|cash|invoice|extra|purchase|free|today|click|promise|trial|quote|thousands|immediately|discount|cheap|break-fix|hourly|guarantee|guaranteed|refund|breach|quick)\b"
def expand(t,rnd):
    while True:
        m=re.search(r"\{(?!\{)([^{}]*)\}(?!\})",t)
        if not m: return t
        opts=m.group(1).split("|")
        if opts[0]=="abtest": opts=[o for o in opts[1:] if o!=""]
        t=t[:m.start()]+rnd.choice(opts)+t[m.end():]
def render(t,p):
    for k,f in VARS.items():
        t=t.replace("{{%s}}"%k,p[f])
    return t
def text(h): return re.sub(r"<br>","\n",re.sub(r"</p><p>","\n\n",re.sub(r"^<p>|</p>$","",h)))
def lint(s,subject):
    f=[]
    if re.search(r"\{|\}|\{\{",s): f.append("leftover brace/variable")
    if re.search(BANNED,(s+" "+subject).lower()): f.append("banned word: "+",".join(set(re.findall(BANNED,(s+' '+subject).lower()))))
    for m in re.finditer(r"\b(a|an)\s+([A-Za-z])",s):
        art,nxt=m.group(1).lower(),m.group(2).lower()
        if (art=="a" and nxt in "aeiou") or (art=="an" and nxt not in "aeiou"): f.append("a/an: '%s'"%s[m.start():m.start()+22])
    if re.search(r"\b(\w+)\s+\1\b",s,re.I): f.append("doubled word")
    if re.search(r"  |\s,|,,|\.\.|\bi\b",s): f.append("spacing/punctuation or lowercase i")
    if re.search(r"\b[A-Z]{3,}\b",s): f.append("ALL CAPS word")
    if re.search(r"writing you|\byou\b\s*$",s.split("\n")[-1]) and "stop writing you" in s: f.append("ungrammatical opt-out")
    for para in s.split("\n\n"):
        first=para.strip()[:1]
        if first and first.islower() and not para.strip().startswith(tuple(os.environ.get("LOWERCASE_OK","").split(",")) if os.environ.get("LOWERCASE_OK") else ("\0",)): f.append("paragraph starts lowercase: "+para[:30])
    for m in re.finditer(r"[.?!]\s+([a-z])",s): f.append("sentence starts lowercase: ..."+s[m.start():m.start()+25])
    if "—" in s or "--" in s: f.append("dash")
    return f
rnd=random.Random(1); bad=0; shown=0; total=0
for step,(sk,bk) in enumerate((("subject1","body1"),(None,"body2"),("subject3","body3")),1):
    for p in pros:
        for _ in range(N):
            subj=expand(render(pay[sk],p),rnd) if sk else "(thread)"
            body=text(expand(render(pay[bk],p),rnd)); total+=1
            fl=lint(body,subj)
            if fl:
                bad+=1
                if bad<=12: print("FLAG step",step,p["firstName"],fl,"\n---\n"+body+"\n")
print(f"rendered {total} emails, flagged {bad}")
sys.exit(1 if bad else 0)
