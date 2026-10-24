#!/usr/bin/env bash
#
# Verifies the built CV PDFs.
#
# Compiling successfully only proves the LaTeX was valid. It does not prove the
# PDF is readable by an applicant tracking system, and the failures that matter
# here are invisible on the rendered page -- they only show up in the text layer.
# Every check below corresponds to a defect that has actually occurred in this
# repository, so each one is a regression guard rather than a hypothetical.
#
# Nothing here is specific to one person. What each PDF must contain -- name,
# contact details, headings, page count -- comes from the .expect file that
# scripts/render.py writes next to the .tex, derived from the same data. The
# file is read line by line and never sourced: it holds the user's text, and a
# name containing $(...) must not run.
#
# Requires poppler-utils (pdftotext, pdfinfo).
#
# Usage: scripts/verify-cv.sh [pdf...]      (defaults to build/*.pdf)

set -uo pipefail

failures=0
checks=0

pass() { checks=$((checks + 1)); printf '    ok   %s\n' "$1"; }
fail() { checks=$((checks + 1)); failures=$((failures + 1)); printf '    FAIL %s\n' "$1"; }

# require <description> <condition-exit-code>
require() {
	if [ "$2" -eq 0 ]; then pass "$1"; else fail "$1"; fi
}

verify_pdf() {
	pdf="$1"
	expect="${pdf%.pdf}.expect"

	printf '\n  %s\n' "$pdf"

	if [ ! -s "$pdf" ]; then
		fail "file exists and is non-empty"
		return
	fi
	pass "file exists and is non-empty"

	if [ ! -r "$expect" ]; then
		fail "expectations file $expect exists (rebuild with 'make')"
		return
	fi

	name='' email='' phone='' pages_expected='' entries_expected=0 chars_expected=0 headings=()
	while IFS='=' read -r key value; do
		case "$key" in
			name)    name="$value" ;;
			email)   email="$value" ;;
			phone)   phone="$value" ;;
			pages)   pages_expected="$value" ;;
			entries) entries_expected="$value" ;;
			chars)   chars_expected="$value" ;;
			heading) headings+=("$value") ;;
		esac
	done < "$expect"

	text="$(pdftotext "$pdf" - 2>/dev/null)"
	pages="$(pdfinfo "$pdf" 2>/dev/null | awk '/^Pages:/{print $2}')"

	# A PDF built from an image, or with a broken font encoding, renders fine and
	# extracts to nothing. That is the worst possible outcome for an ATS. The
	# threshold is half the text the data holds, so it scales from a one-line
	# test fixture to a two-page CV.
	chars="$(printf '%s' "$text" | wc -m | tr -d ' ')"
	[ "$chars" -gt $((chars_expected / 2)) ] && [ "$chars" -gt 0 ]
	require "has a real text layer (${chars} of ~${chars_expected} chars)" $?

	# An exact page count rather than an upper bound: what actually goes wrong is
	# a reflow -- a font update, an engine change, one bullet too many -- pushing
	# a nearly-empty extra page, which is valid PDF and passes every other check.
	# The expected count is settings.pages in the data file.
	[ "${pages:-0}" -eq "$pages_expected" ]
	require "page count is exactly ${pages_expected} (got ${pages:-?})" $?

	# Contact details must survive extraction -- a CV a recruiter cannot reply to
	# is worse than no CV.
	printf '%s' "$text" | grep -Fq -- "$name"
	require "name present in text layer" $?

	if [ -n "$email" ]; then
		printf '%s' "$text" | grep -Fq -- "$email"
		require "email present in text layer" $?
	fi

	if [ -n "$phone" ]; then
		printf '%s' "$text" | grep -Fq -- "$phone"
		require "phone present in text layer" $?
	fi

	# Section headings drive how a parser segments the document, so each must be
	# present verbatim, on a line of its own, in the language of the document.
	# Reading order: the name, then every heading in the order the data declares.
	# If extraction does not run top to bottom like the page, a parser attributes
	# bullets to the wrong job.
	prev="$(printf '%s\n' "$text" | grep -n -m1 -F -- "$name" | cut -d: -f1)"
	missing='' order_ok=0
	[ -n "$prev" ] || order_ok=1
	for h in ${headings[@]+"${headings[@]}"}; do
		line="$(printf '%s\n' "$text" | grep -n -m1 -x -F -- "$h" | cut -d: -f1)"
		if [ -z "$line" ]; then
			missing="$missing '$h'"
			order_ok=1
		elif [ -n "$prev" ] && [ "$line" -le "$prev" ]; then
			order_ok=1
		else
			prev="$line"
		fi
	done
	[ -z "$missing" ]
	require "all ${#headings[@]} section headings present${missing:+ (missing:$missing)}" $?
	[ "$order_ok" -eq 0 ]
	require "reading order is name, then headings in declared order" $?

	# Regression guard: bullets used to be an itemize environment, which placed
	# every marker as its own positioned object. Position-grouping extractors then
	# emitted all the markers together as one run of bullets with no text.
	orphan_bullets="$(printf '%s' "$text" | grep -cE '^[[:space:]]*(•[[:space:]]*)+$')"
	[ "$orphan_bullets" -eq 0 ]
	require "no orphaned bullet markers (found ${orphan_bullets})" $?

	# Regression guard: dates used to be pushed right with \hfill, which split the
	# line into two text objects and let a date detach from its job title and
	# surface on a line of its own.
	# The trailing word ("Present", "Actualidad", "Actualitat") is matched as any
	# run of non-space characters rather than a letter range: a range whose
	# endpoints are accented characters is an invalid collation range in the C
	# locale, and CI runs in one, so grep aborted here and the check misfired.
	orphan_dates="$(printf '%s' "$text" | grep -cE '^[[:space:]]*(19|20)[0-9]{2}([[:space:]]*-[[:space:]]*([0-9]{4}|[^[:space:]|]+))?[[:space:]]*$')"
	[ "$orphan_dates" -eq 0 ]
	require "no dates detached from their entry (found ${orphan_dates})" $?

	# Each dated role and qualification should appear as
	# "Organisation, Location | dates", one per dated entry in the data.
	entries="$(printf '%s' "$text" | grep -cE '\|[[:space:]]*(19|20)[0-9]{2}')"
	[ "$entries" -ge "$entries_expected" ]
	require "entries keep organisation and dates together (${entries} found, expect >= ${entries_expected})" $?

	# Regression guard: \l in a Catalan string was the Polish slashed l, and
	# silently turned col·laborar into colłaborar. The renderer no longer lets
	# users write LaTeX, but a stray ł with no ł in the data still means trouble.
	if ! grep -q 'ł' "$expect" && ! grep -rqs 'ł' "${pdf%.pdf}.tex"; then
		! printf '%s' "$text" | grep -q 'ł'
		require "no stray Polish ł" $?
	fi

	# Unresolved LaTeX references render as ?? and would ship silently.
	! printf '%s' "$text" | grep -q '??'
	require "no unresolved LaTeX references (??)" $?
}

for tool in pdftotext pdfinfo; do
	if ! command -v "$tool" >/dev/null 2>&1; then
		echo "error: $tool not found. Install poppler-utils (Linux) or poppler (brew)." >&2
		exit 2
	fi
done

if [ "$#" -gt 0 ]; then
	targets="$*"
else
	targets="$(ls build/*.pdf 2>/dev/null)"
fi

if [ -z "$targets" ]; then
	echo "error: no CV PDFs found. Run 'make' first." >&2
	exit 2
fi

echo "Verifying CV PDFs"
for pdf in $targets; do
	verify_pdf "$pdf"
done

printf '\n%s\n' "----------------------------------------"
if [ "$failures" -eq 0 ]; then
	printf 'All %d checks passed.\n' "$checks"
	exit 0
fi
printf '%d of %d checks FAILED.\n' "$failures" "$checks"
exit 1
