#!/usr/bin/env python3
"""Extracts field definitions from the Laravel Blade form partials so the Vue forms keep the same fields, labels, order,
required flags and option sources.

Usage: python3 -I tools/extract_blade_forms.py <laravel-repo> <out.json>
"""
import json, os, re, sys

VIEWS = "resources/views"
DIRS = {"create": "profile/form", "edit": "manage/profile/form"}

BLOCK = re.compile(r'<div class="form-group[^"]*"[^>]*>(.*?)</div>\s*</div>', re.S)
LABEL = re.compile(r"<label[^>]*>(.*?)</label>", re.S)
INPUT = re.compile(r"<input\b([^>]*)>", re.S)
SELECT = re.compile(r"<select\b([^>]*)>(.*?)</select>", re.S)
TEXTAREA = re.compile(r"<textarea\b([^>]*)>", re.S)
ATTR = re.compile(r'([\w:@\-]+)\s*=\s*"([^"]*)"')


def clean(s):
    s = re.sub(r"\{\{.*?\}\}", "", s, flags=re.S)
    s = re.sub(r"@\w+.*", "", s)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()


def attrs(chunk):
    return {k: v for k, v in ATTR.findall(chunk)}


def control(kind, tag_attrs, raw, body=None):
    a = attrs(tag_attrs)
    if "name" not in a:
        return None
    c = {"name": a["name"], "type": kind if kind in ("select", "textarea") else a.get("type", "text"),
         "required": bool(re.search(r"\brequired\b", raw))}
    if kind == "input":
        if "placeholder" in a:
            c["placeholder"] = a["placeholder"]
        if re.search(r"\breadonly\b", raw):
            c["readonly"] = True
        if "maxlength" in a:
            c["maxlength"] = int(a["maxlength"]) if a["maxlength"].isdigit() else a["maxlength"]
    if kind == "select":
        src = re.search(r"@foreach\s*\(\s*(\w+)\(\)", body)
        if src:
            c["options"] = {"source": src.group(1)}
        else:
            c["options"] = {"static": [{"value": v, "label": clean(t)} for v, t in
                                       re.findall(r'<option[^>]*value="([^"]*)"[^>]*>(.*?)</option>', body, re.S)]}
    return c


def fields_in(text):
    out = []
    for m in re.finditer(r'<div class="form-group', text):
        nxt = text.find('<div class="form-group', m.end())
        block = text[m.start(): nxt if nxt != -1 else len(text)]
        label = LABEL.search(block)
        controls = []
        # keep document order of selects, inputs and textareas
        for t in re.finditer(r"<select\b([^>]*)>(.*?)</select>|<input\b([^>]*)>|<textarea\b([^>]*)>", block, re.S):
            if t.group(1) is not None:
                c = control("select", t.group(1), t.group(1), t.group(2))
            elif t.group(3) is not None:
                if 'type="hidden"' in t.group(3):
                    continue
                c = control("input", t.group(3), t.group(3))
            else:
                c = control("textarea", t.group(4), t.group(4))
            if c:
                controls.append(c)
        if not controls:
            continue
        f = {"label": clean(label.group(1)) if label else ""}
        if len(controls) == 1:
            f.update(controls[0])
        else:
            f["controls"] = controls
        cond = re.search(r"(v-if|v-show)=\"([^\"]*)\"", block[:300])
        if cond:
            f["condition"] = cond.group(2)
        out.append(f)
    return out


def main(repo, outfile):
    result = {}
    for variant, d in DIRS.items():
        base = os.path.join(repo, VIEWS, d)
        result[variant] = {}
        for fn in sorted(os.listdir(base)):
            if not fn.endswith(".blade.php"):
                continue
            text = open(os.path.join(base, fn)).read()
            result[variant][fn.replace(".blade.php", "")] = fields_in(text)
    json.dump(result, open(outfile, "w"), indent=1)
    for v, sections in result.items():
        print(v, {k: len(f) for k, f in sections.items()}, "total", sum(len(f) for f in sections.values()))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
