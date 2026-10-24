#!/usr/bin/env bash
#
# Renderer and build tests, driven by the fixtures in tests/fixtures/.
#
# Each fixture states what it expects in its own comments:
#   # expect-text: <s>    the built PDFs' text layer must contain <s>
#   # expect-error: <s>   the build must fail and its error output contain <s>
# Fixtures named invalid-*.toml must fail; the rest must build and pass
# scripts/verify-cv.sh. Everything builds through `make`, the one build path,
# into build/test/ so a user's own build/ output is left alone.
#
# Usage: tests/run.sh   (or: make test)

set -uo pipefail

cd "$(dirname "$0")/.."

failures=0
total=0

expectations() { sed -n "s/^# $1: //p" "$2"; }

for fixture in tests/fixtures/*.toml; do
	name="$(basename "$fixture" .toml)"
	out="build/test/$name"
	total=$((total + 1))
	rm -rf "$out"

	log="$(make --no-print-directory all DATA="$fixture" OUT="$out" 2>&1)"
	status=$?
	problems=''

	case "$name" in
	invalid-*)
		[ "$status" -ne 0 ] || problems="$problems\n      build succeeded but should have failed"
		while IFS= read -r want; do
			printf '%s' "$log" | grep -Fq -- "$want" || problems="$problems\n      error output lacks: $want"
		done < <(expectations expect-error "$fixture")
		# A data error must be caught before LaTeX ever runs.
		if printf '%s' "$log" | grep -q 'error: halted\|! LaTeX Error\|^error:'; then
			problems="$problems\n      reached the TeX engine instead of failing validation"
		fi
		;;
	*)
		if [ "$status" -ne 0 ]; then
			problems="$problems\n      build failed:\n$(printf '%s' "$log" | tail -5 | sed 's/^/        /')"
		else
			./scripts/verify-cv.sh "$out"/*.pdf >/dev/null 2>&1 ||
				problems="$problems\n      verify failed: run scripts/verify-cv.sh $out/*.pdf"
			text="$(for pdf in "$out"/*.pdf; do pdftotext "$pdf" -; done)"
			while IFS= read -r want; do
				printf '%s' "$text" | grep -Fq -- "$want" || problems="$problems\n      text layer lacks: $want"
			done < <(expectations expect-text "$fixture")
		fi
		;;
	esac

	if [ -z "$problems" ]; then
		printf '  ok   %s\n' "$name"
	else
		failures=$((failures + 1))
		printf '  FAIL %s' "$name"
		printf '%b\n' "$problems"
	fi
done

printf '\n%s\n' "----------------------------------------"
if [ "$failures" -eq 0 ]; then
	printf 'All %d fixtures behaved as expected.\n' "$total"
	exit 0
fi
printf '%d of %d fixtures FAILED.\n' "$failures" "$total"
exit 1
