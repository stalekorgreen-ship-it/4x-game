# Приводит data/*.json к компактному виду: раздел — по строке на запись (удобно править блокнотом). python3 tools/fmt-data.py файл...
import json,sys,collections
def inl(v):
    if isinstance(v,dict): return "{"+", ".join(json.dumps(k,ensure_ascii=False)+": "+inl(x) for k,x in v.items())+"}"
    if isinstance(v,list): return "["+",".join(inl(x) for x in v)+"]"
    return json.dumps(v,ensure_ascii=False)
for p in sys.argv[1:]:
    d=json.load(open(p,encoding='utf-8'),object_pairs_hook=collections.OrderedDict)
    out=["{"];items=list(d.items())
    for i,(k,v) in enumerate(items):
        end="," if i<len(items)-1 else ""
        if isinstance(v,dict) and v:
            out.append(" "+json.dumps(k,ensure_ascii=False)+": {")
            sub=list(v.items())
            for j,(k2,v2) in enumerate(sub): out.append("  "+json.dumps(k2,ensure_ascii=False)+": "+inl(v2)+("," if j<len(sub)-1 else ""))
            out.append(" }"+end)
        elif isinstance(v,list) and v:
            out.append(" "+json.dumps(k,ensure_ascii=False)+": [")
            for j,x in enumerate(v): out.append("  "+inl(x)+("," if j<len(v)-1 else ""))
            out.append(" ]"+end)
        else: out.append(" "+json.dumps(k,ensure_ascii=False)+": "+inl(v)+end)
    out.append("}")
    open(p,'w',encoding='utf-8').write("\n".join(out)+"\n")
