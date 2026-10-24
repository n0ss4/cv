#!/usr/bin/env bash
#
# Fails if git tracks anything that should never leave this machine.
#
# .gitignore keeps mycv/ and built PDFs out of `git add .`, but not out of
# `git add -f`, and not out of a .gitignore someone edited. This check catches
# both, locally through `make check` and in CI on every push and pull request,
# so personal data that slipped into a commit fails the build before it lands
# on main.
#
# This project exists in its current form because a CV, with phone number,
# email and photo, sat in a public repository and its releases until it had to
# be removed for GDPR reasons. Do not weaken this check to make a build pass.
#
# Usage: scripts/check-privacy.sh

set -uo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	echo "Privacy check skipped: not a git repository."
	exit 0
fi

# Index, not HEAD: a file that is staged but not yet committed is caught too.
offending="$(git ls-files --cached -- 'mycv/*' 'build/*' '*.pdf' '*.PDF')"

if [ -z "$offending" ]; then
	echo "Privacy check passed: no personal data or built PDFs tracked by git."
	exit 0
fi

echo "Privacy check FAILED. These files are tracked by git but must never be committed:" >&2
printf '%s\n' "$offending" | sed 's/^/    /' >&2
cat >&2 <<'MSG'

Your CV data belongs in mycv/ and built PDFs in build/, both ignored by git.
To stop tracking the files while keeping them on disk:

    git rm --cached -r -- <path>

If they were already pushed, removing them in a new commit is not enough --
they remain in the history. See "If you committed personal data" in README.md.
MSG
exit 1
