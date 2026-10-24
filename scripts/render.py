#!/usr/bin/env python3
"""Render a CV data file (TOML) into one LaTeX document per language.

    python3 scripts/render.py DATA --out DIR

For each language declared in the data file this writes, into DIR:

    <output>_<LANG>.tex      the document, compiled by tectonic against atscv.cls
    <output>_<LANG>.expect   what scripts/verify-cv.sh should find in the PDF

and prints the path of each .tex on stdout, one per line, for the Makefile.

Users never write LaTeX: every piece of their text is escaped here. Invalid data
produces one "FILE: field.path: message" line per problem on stderr and writes
nothing, so a mistake in the data file never surfaces as a TeX log.

Standard library only -- the constitution rules out pip installs. TOML parsing
uses tomllib where it exists (Python 3.11+) and otherwise a vendored copy of the
same parser, because macOS still ships Python 3.9 as /usr/bin/python3.
"""

import argparse
import re
import shutil
import sys
from pathlib import Path

try:
    import tomllib
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent / "_vendor"))
    import tomli as tomllib
import unicodedata

# Built-in headings and labels. Copied from the string catalogues of the original
# template, so the wording a parser has been matched against does not change.
# A data file can override any of these, or add a language, under [labels.<code>].
LABELS = {
    "en": {
        "summary": "Summary",
        "skills": "Technical Skills",
        "experience": "Professional Experience",
        "education": "Education",
        "projects": "Projects",
        "certifications": "Certifications",
        "awards": "Awards",
        "languages": "Languages",
        "present": "Present",
    },
    "es": {
        "summary": "Perfil",
        "skills": "Competencias Técnicas",
        "experience": "Experiencia Profesional",
        "education": "Formación",
        "projects": "Proyectos",
        "certifications": "Certificaciones",
        "awards": "Premios",
        "languages": "Idiomas",
        "present": "Actualidad",
    },
    "ca": {
        "summary": "Perfil",
        "skills": "Competències Tècniques",
        "experience": "Experiència Professional",
        "education": "Formació",
        "projects": "Projectes",
        "certifications": "Certificacions",
        "awards": "Premis",
        "languages": "Idiomes",
        "present": "Actualitat",
    },
}

DEFAULT_ORDER = [
    "summary", "skills", "experience", "education",
    "projects", "certifications", "awards", "languages",
]

# Keys that are configuration rather than CV sections.
RESERVED = {"settings", "header", "labels"}

DEFAULT_ACCENT = "115E59"

SETTINGS_KEYS = {"languages", "font_size", "pages", "accent", "output", "order"}
HEADER_KEYS = {"name", "headline", "location", "phone", "email", "photo", "links"}

# In TOML a key belongs to the [table] above it, so `summary = "..."` written
# after [header] silently becomes header.summary. Say so instead of ignoring it.
MISPLACED_HINT = ("unknown field; if this is a section, write it as its own table, "
                  "e.g. [{key}] with text = \"...\", or move it above the first [table]")


class DataError(Exception):
    pass


class Errors:
    """Collects every problem in one pass so the user can fix them all at once."""

    def __init__(self, source):
        self.source = source
        self.items = []

    def add(self, path, message):
        self.items.append(f"{self.source}: {path}: {message}")

    def __bool__(self):
        return bool(self.items)


# --------------------------------------------------------------------------
# Escaping
# --------------------------------------------------------------------------

_SPECIALS = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
    # The class uses a vertical bar as its separator, so a literal one in the
    # text would read as structure to anyone scanning the extracted text.
    "|": r"\textbar{}",
}
_SPECIALS_RE = re.compile("|".join(re.escape(c) for c in _SPECIALS))


def escape(text):
    """Escape user text for LaTeX. UTF-8 passes straight through: under tectonic
    the font is OpenType, so accented letters need no macros."""
    text = " ".join(str(text).split())
    text = _SPECIALS_RE.sub(lambda m: _SPECIALS[m.group(0)], text)
    # TeX font ligatures would turn -- into an en dash and `` into a quote;
    # the user wrote two characters and should get two characters.
    text = text.replace("--", "-{}-").replace("``", "`{}`").replace("''", "'{}'")
    return text


def plain(text):
    """Text as it will appear in the PDF's text layer, for the .expect file."""
    return " ".join(str(text).split())


# --------------------------------------------------------------------------
# Localisation
# --------------------------------------------------------------------------


class Localiser:
    def __init__(self, languages, errors):
        self.languages = languages
        self.errors = errors

    def is_localised(self, value):
        return isinstance(value, dict) and value and all(
            isinstance(k, str) and re.fullmatch(r"[a-z]{2,3}(-[a-z0-9]+)?", k) for k in value
        )

    def check(self, value, path, kind="text"):
        """Validate a localisable value for every declared language."""
        if self.is_localised(value):
            for lang in self.languages:
                if lang not in value:
                    self.errors.add(path, f'missing translation for "{lang}"')
                else:
                    self.check(value[lang], path, kind)
            return
        if kind == "list":
            if isinstance(value, list):
                for i, item in enumerate(value):
                    self.check(item, f"{path}[{i}]")
                return
            self.check(value, path)  # a single string is a one-item list
            return
        if isinstance(value, (str, int, float)) and not isinstance(value, bool):
            if not str(value).strip():
                self.errors.add(path, "must not be empty")
            return
        self.errors.add(path, f"expected text, got {type(value).__name__}")

    def get(self, value, lang):
        if self.is_localised(value):
            return self.get(value[lang], lang)
        if isinstance(value, list):
            return [self.get(v, lang) for v in value]
        return str(value)


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------


def text_of(value):
    """A text section is either localisable text itself or a table with `text`."""
    if isinstance(value, dict) and set(value) == {"text"}:
        return value["text"]
    return value


def shape_of(items):
    """Work out how an array-of-tables section renders from what its items hold."""
    if not isinstance(items, list) or not items or not all(isinstance(i, dict) for i in items):
        return None
    shapes = set()
    for item in items:
        if "keywords" in item:
            shapes.add("skills")
        elif "title" in item:
            shapes.add("entries")
        elif "label" in item:
            shapes.add("lines")
        else:
            shapes.add("unknown")
    return shapes.pop() if len(shapes) == 1 else "mixed"


def default_output(name):
    """CV_<name> in plain ASCII: "Àlex Núñez" -> CV_Alex_Nunez."""
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return "CV_" + (re.sub(r"[^A-Za-z0-9-]+", "_", ascii_name).strip("_") or "output")


def validate(data, source):
    errors = Errors(source)

    settings = data.get("settings", {})
    if not isinstance(settings, dict):
        errors.add("settings", "must be a table")
        settings = {}

    for key in settings:
        if key not in SETTINGS_KEYS:
            errors.add(f"settings.{key}", MISPLACED_HINT.format(key=key))

    languages = settings.get("languages", ["en"])
    if (not isinstance(languages, list) or not languages
            or not all(isinstance(l, str) and re.fullmatch(r"[a-z]{2,3}", l) for l in languages)):
        errors.add("settings.languages", 'must be a list of language codes, e.g. ["en", "es"]')
        languages = ["en"]
    elif len(set(languages)) != len(languages):
        errors.add("settings.languages", "lists a language twice")

    font_size = settings.get("font_size", 10)
    if font_size not in (9, 10, 11):
        errors.add("settings.font_size", "must be 9, 10 or 11")

    pages = settings.get("pages", 2)
    if not isinstance(pages, int) or isinstance(pages, bool) or pages < 1:
        errors.add("settings.pages", "must be a positive whole number")

    accent = settings.get("accent", DEFAULT_ACCENT)
    if not isinstance(accent, str) or not re.fullmatch(r"[0-9A-Fa-f]{6}", accent):
        errors.add("settings.accent", 'must be six hex digits without "#", e.g. "115E59"')

    if "output" in settings and not (
        isinstance(settings["output"], str) and re.fullmatch(r"[A-Za-z0-9_-]+", settings["output"])
    ):
        errors.add("settings.output", "may only contain letters, digits, _ and -")

    loc = Localiser(languages, errors)

    header = data.get("header")
    if not isinstance(header, dict):
        errors.add("header", "is required: a [header] table with at least name and headline")
        header = {}
    else:
        for key in header:
            if key not in HEADER_KEYS:
                errors.add(f"header.{key}", MISPLACED_HINT.format(key=key))
        if not isinstance(header.get("name"), str) or not header["name"].strip():
            errors.add("header.name", "is required")
        if "headline" not in header:
            errors.add("header.headline", "is required")
        else:
            loc.check(header["headline"], "header.headline")
        if "location" in header:
            loc.check(header["location"], "header.location")
        for key in ("phone", "email"):
            if key in header and (not isinstance(header[key], str) or not header[key].strip()):
                errors.add(f"header.{key}", "must be text")
        if "photo" in header:
            photo = header["photo"]
            if not isinstance(photo, str) or not photo:
                errors.add("header.photo", "must be a file path")
            else:
                p = (Path(source).parent / photo)
                if p.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                    errors.add("header.photo", "must be a .jpg or .png file")
                elif not p.is_file():
                    errors.add("header.photo", f"file not found: {p}")
        links = header.get("links", [])
        if not isinstance(links, list):
            errors.add("header.links", "must be a list of { text, url }")
        else:
            for i, link in enumerate(links):
                path = f"header.links[{i}]"
                if not isinstance(link, dict) or "text" not in link or "url" not in link:
                    errors.add(path, "needs text and url")
                    continue
                loc.check(link["text"], f"{path}.text")
                if not isinstance(link["url"], str) or not link["url"].strip():
                    errors.add(f"{path}.url", "must be text")

    labels = data.get("labels", {})
    if not isinstance(labels, dict) or not all(isinstance(v, dict) for v in labels.values()):
        errors.add("labels", "must be tables of the form [labels.<language>]")
        labels = {}

    def label(lang, key):
        return labels.get(lang, {}).get(key, LABELS.get(lang, {}).get(key))

    order = settings.get("order")
    if order is None:
        order = [k for k in DEFAULT_ORDER if k in data]
        order += [k for k in data if k not in RESERVED and k not in order]
    elif not isinstance(order, list) or not all(isinstance(k, str) for k in order):
        errors.add("settings.order", "must be a list of section names")
        order = []
    else:
        for i, key in enumerate(order):
            if key not in data:
                errors.add(f"settings.order[{i}]", f'section "{key}" is not in the file')

    for key in order:
        if key not in data or key in RESERVED:
            continue
        value = data[key]
        for lang in languages:
            if not label(lang, key):
                errors.add(key, f'has no heading for "{lang}": add {key} = "..." under [labels.{lang}]')
        if not isinstance(value, list):
            loc.check(text_of(value), key)
            continue
        shape = shape_of(value)
        if shape in (None, "unknown"):
            errors.add(key, "each item needs keywords (skills), title (entries) or label (lines)")
        elif shape == "mixed":
            errors.add(key, "mixes item kinds; use one of keywords, title or label throughout")
        for i, item in enumerate(value):
            path = f"{key}[{i}]"
            if not isinstance(item, dict):
                continue
            if shape == "skills":
                loc.check(item.get("label", ""), f"{path}.label")
                loc.check(item["keywords"], f"{path}.keywords", "list")
            elif shape == "entries":
                loc.check(item["title"], f"{path}.title")
                if not isinstance(item.get("org"), str) or not item["org"].strip():
                    errors.add(f"{path}.org", "is required")
                if "location" in item:
                    loc.check(item["location"], f"{path}.location")
                if "end" in item and "start" not in item:
                    errors.add(f"{path}.start", "is required when end is given")
                for d in ("start", "end"):
                    if d in item and (isinstance(item[d], bool) or not str(item[d]).strip()):
                        errors.add(f"{path}.{d}", "must be a year or text")
                if "bullets" in item:
                    loc.check(item["bullets"], f"{path}.bullets", "list")
            elif shape == "lines":
                loc.check(item["label"], f"{path}.label")
                if "value" not in item:
                    errors.add(f"{path}.value", "is required")
                else:
                    loc.check(item["value"], f"{path}.value")

    if errors:
        raise DataError("\n".join(errors.items))

    output = settings.get("output") or default_output(header["name"])
    return {
        "languages": languages,
        "font_size": font_size,
        "pages": pages,
        "accent": accent.upper(),
        "output": output,
        "order": order,
        "label": label,
        "loc": loc,
    }


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------


def render(data, cfg, lang, photo_name):
    loc, label = cfg["loc"], cfg["label"]
    header = data["header"]
    out = []
    expect = [("name", plain(header["name"])), ("pages", str(cfg["pages"]))]
    entries = 0
    printed = [0]

    def tex(text):
        printed[0] += len(plain(text))
        return escape(text)

    out.append(f"\\documentclass[{cfg['font_size']}pt]{{atscv}}")
    if cfg["accent"] != DEFAULT_ACCENT:
        out.append(f"\\definecolor{{cvaccent}}{{HTML}}{{{cfg['accent']}}}")
    out.append("\\begin{document}")
    out.append("")

    line1 = []
    if "location" in header:
        line1.append(tex(loc.get(header["location"], lang)))
    if "phone" in header:
        line1.append(tex(header["phone"]))
        expect.append(("phone", plain(header["phone"])))
    if "email" in header:
        email = header["email"].strip()
        line1.append(f"\\href{{mailto:{email}}}{{{tex(email)}}}")
        expect.append(("email", plain(email)))
    line2 = [
        f"\\href{{{link['url'].strip()}}}{{{tex(loc.get(link['text'], lang))}}}"
        for link in header.get("links", [])
    ]
    contact = "\\cvsep\n\t".join(line1)
    if line2:
        contact += ("\\\\[3pt]\n\t" if line1 else "") + "\\cvsep\n\t".join(line2)

    out.append(f"\\cvheader{{{photo_name}}}{{{tex(header['name'])}}}"
               f"{{{tex(loc.get(header['headline'], lang))}}}{{%")
    out.append(f"\t{contact}%")
    out.append("}")

    for key in cfg["order"]:
        value = data[key]
        heading = label(lang, key)
        expect.append(("heading", plain(heading).upper()))
        out.append("")
        out.append(f"\\cvsect{{{tex(heading)}}}")
        out.append("")
        if not isinstance(value, list):
            out.append(tex(loc.get(text_of(value), lang)))
            out.append("")
            continue
        shape = shape_of(value)
        for item in value:
            if shape == "skills":
                kw = loc.get(item["keywords"], lang)
                kw = ", ".join(kw) if isinstance(kw, list) else kw
                out.append(f"\\cvskill{{{tex(loc.get(item.get('label', ''), lang))}}}{{{tex(kw)}}}")
            elif shape == "lines":
                out.append(f"\\cvline{{{tex(loc.get(item['label'], lang))}}}"
                           f"{{{tex(loc.get(item['value'], lang))}}}")
            else:
                dates = ""
                if "start" in item:
                    entries += 1
                    dates = str(item["start"]).strip()
                    if "end" in item:
                        end = str(item["end"]).strip()
                        if end.lower() == "present":
                            end = label(lang, "present") or "Present"
                        dates += f" - {end}"
                location = loc.get(item["location"], lang) if "location" in item else ""
                out.append(f"\\cventry{{{tex(loc.get(item['title'], lang))}}}{{{tex(item['org'])}}}"
                           f"{{{tex(location)}}}{{{tex(dates)}}}")
                bullets = loc.get(item.get("bullets", []), lang)
                if isinstance(bullets, str):
                    bullets = [bullets]
                for b in bullets:
                    out.append(f"\t\\cvitem{{{tex(b)}}}")
                out.append("")

    out.append("")
    out.append("\\end{document}")
    expect.append(("entries", str(entries)))
    # How much of the user's text the PDF should yield, for the text-layer check.
    expect.append(("chars", str(printed[0])))
    return "\n".join(out) + "\n", "".join(f"{k}={v}\n" for k, v in expect)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("data", type=Path, help="CV data file (TOML)")
    ap.add_argument("--out", type=Path, default=Path("build"), help="output directory")
    args = ap.parse_args()

    try:
        with args.data.open("rb") as f:
            data = tomllib.load(f)
    except FileNotFoundError:
        sys.exit(f"{args.data}: file not found (run 'make new' to start your CV)")
    except tomllib.TOMLDecodeError as e:
        sys.exit(f"{args.data}: not valid TOML: {e}")

    try:
        cfg = validate(data, args.data)
    except DataError as e:
        sys.exit(str(e))

    args.out.mkdir(parents=True, exist_ok=True)

    # The photo is copied next to the generated file and referenced by bare name:
    # a path with spaces, which a home directory easily has, breaks \includegraphics.
    photo_name = ""
    if "photo" in data["header"]:
        src = args.data.parent / data["header"]["photo"]
        photo_name = f"{cfg['output']}-photo{src.suffix.lower()}"
        shutil.copyfile(src, args.out / photo_name)

    for lang in cfg["languages"]:
        doc, expect = render(data, cfg, lang, photo_name)
        base = args.out / f"{cfg['output']}_{lang.upper()}"
        base.with_suffix(".tex").write_text(doc, encoding="utf-8")
        base.with_suffix(".expect").write_text(expect, encoding="utf-8")
        print(base.with_suffix(".tex"))


if __name__ == "__main__":
    main()
