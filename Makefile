# Your data wins once it exists; until then the fictional example builds, so a
# fresh copy produces a PDF with no setup. Override with: make DATA=path/cv.toml
DATA ?= $(if $(wildcard mycv/cv.toml),mycv/cv.toml,example/cv.toml)
OUT ?= build

# macOS ships Python 3.9; render.py falls back to a vendored TOML parser there.
PYTHON ?= python3

# Tectonic rather than latexmk, and this Makefile is the only definition of the
# build: CI installs this same version and runs these targets. When CI compiled
# separately with pdfLaTeX, the two drifted -- different flags, a different
# engine, and a line that wrapped differently in the published PDF than in the
# one built here. Tectonic's TeX Live snapshot is fixed by the binary's version,
# so pinning the version pins the output.
TECTONIC ?= tectonic

# The generated .tex files live in build/; search-path lets them find atscv.cls
# at the root without a copy that could drift from the original.
TECTONIC_FLAGS = -Z search-path=$(CURDIR) --outdir $(OUT)

all:
	@# Stale output from a language since removed would otherwise be verified.
	@mkdir -p $(OUT) && rm -f $(OUT)/*.tex $(OUT)/*.expect $(OUT)/*.pdf
	@echo "Building from $(DATA)"
	@$(PYTHON) scripts/render.py $(DATA) --out $(OUT) > $(OUT)/.targets
	@while read -r tex; do \
		$(TECTONIC) $(TECTONIC_FLAGS) "$$tex" || exit 1; \
	done < $(OUT)/.targets
	@ls -1 $(OUT)/*.pdf

# Starts your own CV from the example, in mycv/ -- which git ignores.
new:
	@if [ -e mycv/cv.toml ]; then \
		echo "mycv/cv.toml already exists; not overwriting it." >&2; exit 1; \
	fi
	@mkdir -p mycv
	@cp example/cv.toml mycv/cv.toml
	@cp example/photo.png mycv/photo.png
	@echo "Created mycv/cv.toml. Edit it, then run: make check"

# Compiling only proves the LaTeX was valid. This checks the built PDFs are
# actually readable by an applicant tracking system -- see scripts/verify-cv.sh.
verify:
	@./scripts/verify-cv.sh

# Fails if anything personal is tracked by git -- see scripts/check-privacy.sh.
privacy:
	@./scripts/check-privacy.sh

# Renderer edge cases: valid fixtures must build and verify, invalid ones must
# be rejected with the offending field named.
test:
	@./tests/run.sh

check: all verify privacy

# The in-browser ATS checker (web/): React + TypeScript, built with Vite. The
# npm toolchain is for web/ only (constitution V) -- nothing here is needed to
# build a CV. Servers bind to the loopback interface only: nothing here should
# be reachable from the network.
WEB_PORT ?= 8000
NPM ?= npm
WEB_RUN = $(NPM) --prefix web run --silent

# Exactly the lockfile, nothing newer: `npm ci`, re-run only when it changes.
web/node_modules/.package-lock.json: web/package-lock.json
	@$(NPM) --prefix web ci --no-audit --no-fund

web-deps: web/node_modules/.package-lock.json

web: web-deps
	@$(WEB_RUN) dev -- --port $(WEB_PORT) --strictPort

# Type-checks, then bundles to web/dist/ with the production CSP. This is what
# CI deploys to GitHub Pages.
web-build: web-deps
	@$(WEB_RUN) build

# Serves web/dist/ exactly as Pages will.
web-preview: web-build
	@$(WEB_RUN) preview -- --port $(WEB_PORT) --strictPort

# Builds the checker's PDF fixtures and the example CV, then runs every web
# suite (domain, application, adapters, UI, architecture, built-page CSP).
WEB_FIXTURES = build/web-fixtures
web-fixtures:
	@mkdir -p $(WEB_FIXTURES)
	@$(MAKE) --no-print-directory all DATA=example/cv.toml OUT=$(WEB_FIXTURES)/example >/dev/null
	@for tex in web/tests/fixtures/[!_]*.tex; do \
		$(TECTONIC) -Z search-path=$(CURDIR) --outdir $(WEB_FIXTURES) "$$tex" >/dev/null 2>&1 || \
			{ echo "fixture failed to build: $$tex" >&2; exit 1; }; \
	done

web-test: web-deps web-fixtures web-build
	@$(WEB_RUN) test

# Prompt evaluation with the real on-device model: copies the fixture PDFs next
# to the page (web/eval-fixtures/, ignored) and serves it. Open
# /eval.html in a Chrome with built-in AI.
web-eval: web-deps web-fixtures
	@rm -rf web/eval-fixtures && mkdir -p web/eval-fixtures/example
	@cp $(WEB_FIXTURES)/*.pdf web/eval-fixtures/ && cp $(WEB_FIXTURES)/example/*.pdf web/eval-fixtures/example/
	@echo "Prompt evaluation on http://127.0.0.1:$(WEB_PORT)/eval.html"
	@$(WEB_RUN) dev -- --port $(WEB_PORT) --strictPort

clean:
	rm -rf $(OUT)

.PHONY: all new verify privacy test check clean web web-deps web-build web-preview web-fixtures web-test web-eval
