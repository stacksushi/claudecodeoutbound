# Render gate for plain-variable ({{first_name}}) copy: renders full emails with real lead values, lints renders.
# Usage: python3 render_lint_sl.py bodies_plain.json subjects.json leads.json [N=40]
import json, re, random, sys
B=json.load(open(sys.argv[1])); S=json.load(open(sys.argv[2])); L=json.load(open(sys.argv[3])); N=int(sys.argv[4]) if len(sys.argv)>4 else 40
BAN=r"\b(get|getting|bank|credit|access|open|compare|problem|now|billing|deal|finance|financial|claims|insurance|mortgage|soon|new|performance|freedom|home|sales|medical|urgent|life|marketing|investment|diagnostics|friend|cash|invoice|extra|purchase|free|today|click|promise|trial|quote|thousands|immediately|discount|cheap|break-fix|hourly|guarantee|guaranteed|refund|breach|quick)\b"
def expand(t,r):
    while True:
        m=re.search(r"\{(?!\{)([^{}]*)\}(?!\})",t)
        if not m: return t
        t=t[:m.start()]+r.choice(m.group(1).split("|"))+t[m.end():]
def render(t,p):
    for k,v in p.items(): t=t.replace("{{%s}}"%k,v)
    return t
def lint(s,subj):
    f=[]
    if re.search(r"[{}]",s+subj): f.append("leftover brace/variable")
    w=set(re.findall(BAN,(s+" "+subj).lower()))
    if w: f.append("banned: "+",".join(w))
    for m in re.finditer(r"\b(a|an)\s+([A-Za-z])",s):
        a,n=m.group(1).lower(),m.group(2).lower()
        if (a=="a" and n in "aeiou") or (a=="an" and n not in "aeiou"): f.append("a/an: "+s[m.start():m.start()+22])
    if re.search(r"\b(\w+)\s+\1\b",s,re.I): f.append("doubled word")
    if re.search(r"  |\s,|,,|\.\.|\bi\b",s): f.append("spacing/punctuation or lowercase i")
    if re.search(r"\b[A-Z]{3,}\b",s): f.append("ALL CAPS word")
    for para in s.split("\n\n"):
        if para.strip()[:1].islower(): f.append("paragraph starts lowercase: "+para[:30])
    for m in re.finditer(r"[.?!]\s+([a-z])",s): f.append("sentence starts lowercase: "+s[m.start():m.start()+25])
    if "—" in s or "--" in s: f.append("dash")
    if subj and len(subj.split())>4: f.append("subject over 4 words: "+subj)
    return f
rnd=random.Random(5); bad=0; tot=0
for key,body in B.items():
    for p in L:
        for _ in range(N):
            subj=expand(render(S["subject1"],p),rnd) if key.startswith("e1") else ""
            s=expand(render(body,p),rnd); tot+=1; fl=lint(s,subj)
            if fl:
                bad+=1
                if bad<=10: print("FLAG",key,p["first_name"],fl,"\n"+s+"\n")
print(f"rendered {tot} emails, flagged {bad}"); sys.exit(1 if bad else 0)
