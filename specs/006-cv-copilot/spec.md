# Feature Specification: Chat with your CV (one assistant, beside the report)

**Feature Branch**: `006-cv-copilot`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description (Spanish, translated): "Unify all the chats into something more
correct and useful. Imagine the user wants to chat with their CV. Ask it questions for this job
posting, which they should be able to touch up: am I right for this? Everything in general, with
correct UX and a good, practical space." The owner chose a **fixed side panel** next to the report
(a bottom sheet on mobile) and **the posting as context**: the chat answers "am I right for
this?" from the job match the page computes, and the Job match tab stays as the detailed report.

## Clarifications

### Session 2026-10-17

- Q: Where does the chat live? → A: In a panel fixed beside the results, available from every
  tab, so the report and the conversation are visible together. Citations and suggestions move
  the report, not the conversation. On narrow screens a button opens it as a sheet.
- Q: How does the job posting fit in? → A: The posting becomes context of the conversation: it can
  be added from the chat (or from the Job match tab, which keeps the detailed report). Fit
  questions are answered from the page's computed match: percentage, hard filters, keywords and
  gaps. The model explains that match; it does not judge fit on its own.

### Session 2026-10-17 (design review)

- Owner feedback on the first build: "not intuitive, the chat doesn't show properly, you have to
  scroll, the sizes are wrong". Measured cause: the panel was a floating card stuck under the
  sticky header and taller than the window, so the composer was off screen. At 1024 px it also
  covered the report's category card.
- Q: How should the chat sit? → A: Docked to the window under the header, with exactly the
  window's height and its own scrolling. The composer is always visible. The report column lays
  itself out by the width it gets (container queries). On narrow screens the chat is full screen.
  When collapsed, a floating button brings it back.
- The panel's anatomy:
  - header (title and two actions);
  - context (the CV with its score; the posting with its %, Change and Remove, or a clear "Add
    a job posting" action);
  - the conversation;
  - the composer.
- The empty state asks a question and lists the suggestions as buttons. Adding or changing the
  posting uses the whole panel. Follow-up suggestions are at most two.

### Session 2026-10-17 (one place for the posting)

- Q: With the chat, should the Job match tab go? → A: Its form goes; its report stays. The
  posting is added, changed and removed only in the chat. The Job match tab is the detailed
  report of the posting in context. It exists only while there is one, and its name carries the
  match ("Job match · 43%"). Removing the posting removes it everywhere: chat context, tab, and
  score (the report goes back to the version without the posting).

## Context

005 added an **Ask** tab, and 004 a **Job match** tab with its own paste form. They are two
separate places, and the chat refuses anything about postings. People don't think in tabs. They
have one CV and, often, one posting, and they want to ask: "am I right for this?", "what should I
change for this one?", "rewrite my summary for it". Then they want to change their CV and see if
it got better.

This feature makes the chat the one place to ask anything, shown beside the report and aware of
the posting. It keeps every rule of 003–005:
- citations are checked against the CV;
- rewrites may only reword what the CV says;
- out-of-scope questions get the page's own refusal;
- CV text is data, never instructions;
- the chat cannot change the report.

Two additions:
- **Figures come from the page.** When an answer is about fit, keywords or gaps, the numbers and
  lists shown are cards the page renders from its own computation. The model picks which card is
  relevant, but it cannot write the numbers.
- **The edit loop.** After touching up the CV, the user drops the new version. The conversation,
  the posting and the comparison carry over, and the chat says what changed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chat with my CV from anywhere in the results (Priority: P1)

After an analysis, the chat panel sits beside the report on wide screens and is reachable from a
button on narrow ones. The user asks a question or picks a suggestion. The answer cites CV lines,
and clicking a citation shows the line in the ATS view without closing or resetting the chat.
The user can switch report tabs, and the conversation stays.

**Why this priority**: it replaces the Ask tab; everything else builds on it.

**Independent Test**: with a scripted model on the example CV, open the Overview tab and ask "What
should I fix first?" from the panel. The answer appears in the panel with a verified citation.
Clicking it switches the report to the ATS view with the line highlighted, and the panel still
shows the conversation.

**Acceptance Scenarios**:

1. **Given** results on a screen ≥ 1024 px wide, **When** shown, **Then** the chat panel is
   visible beside the report, with a context bar, suggestions and a composer, and there is no
   Ask tab.
2. **Given** a screen < 1024 px, **When** results are shown, **Then** a "Chat with your CV"
   button opens the chat as a sheet. Clicking a citation closes the sheet and shows the line in
   the ATS view; reopening it shows the same conversation.
3. **Given** a conversation, **When** the user changes report tabs, **Then** the conversation, the
   draft and any running answer are preserved.
4. **Given** the panel on a wide screen, **When** the user hides it, **Then** the report uses the
   full width and a "Chat" button brings the panel back with the conversation intact.

---

### User Story 2 - Ask about a job posting: "am I right for this?" (Priority: P1)

From the chat's context bar the user adds a posting: they paste it, optionally with its title,
and the page runs 004's comparison. A page message reports the result in one line: match %,
required items covered, hard filters not met or not stated. A chip shows the posting while it
is the context. The suggestions change to posting questions. When the user asks "am I right for
this?", the answer explains the computed match and shows a **fit card** rendered by the page:
- the percentage and verdict;
- required and preferred items covered;
- each hard filter with its outcome.

Questions about keywords or gaps show those cards. A posting compared from the Job match tab
becomes the chat's context too.

**Why this priority**: it is the owner's main example; it joins 004 and 005.

**Independent Test**: with a scripted model, add the backend posting fixture from the chat. The
page message appears with the computed percentage, and the chip shows the posting's title. Ask
"Am I right for this?". The answer shows a fit card whose figures equal the Job match tab's
figures, even though the scripted model's text claims a different percentage.

**Acceptance Scenarios**:

1. **Given** the panel, **When** the user adds a posting, **Then** a page message (labelled as
   computed by the page, not AI) summarises the match and links to the Job match tab, and the
   context bar shows the posting.
2. **Given** a posting in context, **When** the user asks about fit, keywords or gaps, **Then**
   the answer can show up to 2 page cards (fit, hard filters, keywords, gaps) built only from the
   computed match. Model text that contradicts a figure doesn't change the card.
3. **Given** a hard filter the CV doesn't state, **When** the fit card shows it, **Then** it says
   "not stated in your CV", never "fails", as in 004.
4. **Given** no posting in context, **When** the user asks something posting-specific, **Then**
   the answer invites them to add a posting, with the "Add a posting" action. It is not a refusal.
5. **Given** a posting in context, **When** the user replaces it, **Then** a page message notes
   the change, and later answers use the new posting.

---

### User Story 3 - Touch up the CV for the posting (Priority: P1)

The user asks "rewrite my summary for this posting" or "how do I add Kubernetes?". Rewrite
cards show the original line, the proposal, **Copy** and **Show line**. A rewrite may use the
posting's exact wording of a skill the CV already has (for example "Kubernetes" for the CV's
"K8s"). A rewrite that adds something the CV doesn't support is withheld. When the addition is
something the posting asks for, the card says so plainly: "the posting asks for Terraform; your
CV doesn't mention it. Add it yourself only if it's true."

**Why this priority**: "which they should be able to touch up" is the point of the request.

**Independent Test**: a scripted model proposes two rewrites of the skills line. One swaps
"K8s" for "Kubernetes", and the posting uses "Kubernetes". The other adds "Terraform", which
the posting asks for but the CV lacks. The first is shown with Copy. The second is withheld with
the posting-specific explanation.

**Acceptance Scenarios**:

1. **Given** a posting in context, **When** a rewrite uses a posting term the CV already contains
   in another form, **Then** it passes the guard.
2. **Given** a rewrite that adds a posting term the CV doesn't contain, **When** shown, **Then**
   it is withheld with "the posting asks for X; your CV doesn't mention it".
3. **Given** any shown rewrite, **When** the user presses Copy, **Then** the text is copied and a
   hint says to paste it into the CV and drop the new version to see the change.

---

### User Story 4 - The edit loop: drop the new version, keep the conversation (Priority: P2)

After editing, the user drops the new version of the CV. The analysis runs as before. When it
ends:
- the conversation is still there;
- if a posting was in context, it is compared again automatically;
- a page message says what changed: score before → after, findings resolved, and the match %
  before → after.

Citations in earlier answers point to the previous version. They are shown as "previous version"
and no longer link.

**Why this priority**: closes the loop; useful but the tool works without it.

**Independent Test**: with a scripted model, add a posting, then drop a second file. After the
analysis, the panel keeps the earlier messages, its last message is the page's change summary
with both scores and both match percentages, and an earlier citation is marked "previous
version".

**Acceptance Scenarios**:

1. **Given** a conversation and a new file, **When** its analysis finishes, **Then** the
   conversation is kept and a page message summarises the changes.
2. **Given** a posting in context, **When** a new version is analysed, **Then** the posting is
   compared again without being pasted again.
3. **Given** messages from a previous version, **When** displayed, **Then** their citations and
   "Show line" actions are marked "previous version" and do not link.
4. **Given** the user presses **Clear everything**, **When** done, **Then** the conversation, the
   posting and the reports are all gone, as before.

---

### User Story 5 - Honest, private, usable (Priority: P2)

The rules of 005 are kept:
- every AI answer is labelled AI, with verified or unverified citations;
- page messages and cards are labelled as computed by the page;
- out-of-scope questions get the refusal;
- the conversation is held in memory only;
- each chat tool call appears in the AI log;
- Stop cancels.

Without on-device AI, the panel still lets the user add a posting and shows the page's
computations, and it explains that questions need the on-device AI. "New conversation" clears
the messages but keeps the posting.

**Acceptance Scenarios**:

1. **Given** no on-device AI, **When** the panel is shown, **Then** the composer is replaced by an
   explanation, and adding a posting still produces the page's match message and cards.
2. **Given** a conversation, **When** the user presses "New conversation", **Then** the messages
   are removed, and the posting and the report stay.
3. **Given** the sheet on mobile, **When** open, **Then** focus is trapped in it, Escape closes it
   and focus returns to the button.

---

### Edge Cases

- **Very long posting:** trimmed as in 004, and the page message says it was trimmed.
- **Posting comparison fails:** the page message says so, the chip is not added, and the chat
  continues without a posting.
- **A posting is added while an answer is running:** the add action waits until the answer ends
  (or Stop).
- **The new file is a different CV** (another name in the profile): the conversation is still
  kept. The change summary says the name changed, and older citations are marked previous
  version.
- **The model asks for a card that has no data** (a keywords card without a posting): the card is
  dropped.
- **Panel width at 1024–1279 px:** the report column keeps at least 600 px; the panel is 360 px.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The chat MUST be one panel available from every results tab:
  - at widths ≥ 1024 px, docked beside the report, filling the window under the header, with the
    composer always visible without scrolling the page; it can be collapsed;
  - below 1024 px, a full-screen dialog;
  - when collapsed or closed, a floating button opens it.

  The report MUST NOT be covered at any width. The Ask tab MUST be removed.
- **FR-002**: The panel MUST show a context bar with the CV (file name) and the posting in
  context, if any. It MUST offer "Add a posting" (paste plus optional title) or "Change posting",
  and "New conversation".
- **FR-003**: The posting MUST be added, changed and removed only from the chat. Adding it MUST
  run 004's comparison, set it as the chat's context, show the Job match tab (named with the
  match %) and add a page message with the one-line summary. Removing it MUST hide the tab and
  restore the report and score of that version without the posting.
- **FR-004**: With a posting in context, the assistant MUST receive a compact version of the
  computed match: title, percentage, verdict, required and preferred coverage, hard filters with
  outcomes, and keywords and requirements with status. Its scope MUST include questions about
  that posting.
- **FR-005**: Answers MAY request up to 2 page cards: fit, hard filters, keywords, gaps. Cards
  MUST be rendered by the page from the computed match only, and labelled as computed by the
  page. A card without data MUST be dropped.
- **FR-006**: Rewrites MUST pass 004's guard against their source line, plus the posting terms
  the CV already contains (in any form). A withheld rewrite whose additions include posting terms
  the CV lacks MUST say so specifically.
- **FR-007**: Suggestions MUST depend on context. Without a posting: "What should I fix first?",
  "What does the ATS see as my most recent job?", "Rewrite my summary to focus on results", "Why
  does my CV get this score?". With a posting: "Am I right for this job?", "What should I change
  for this posting?", "Which keywords am I missing?", "Rewrite my summary for this posting".
- **FR-008**: Clicking a citation or "Show line" MUST show the line in the ATS view of the report.
  On narrow screens it MUST close the sheet first.
- **FR-009**: Dropping a new file MUST keep the conversation and the posting text. After the
  analysis, the page MUST re-run the comparison if there was a posting, and add a page message
  with score before → after, resolved/new findings and match % before → after. Citations from
  earlier versions MUST be shown as "previous version", without links.
- **FR-010**: "Clear everything" MUST remove the conversation, the posting and the reports. "New
  conversation" MUST remove only the messages.
- **FR-011**: Everything in 005 FR-003, FR-005, FR-006, FR-007, FR-008, FR-009 still applies:
  - answer limits;
  - the page's refusal for out-of-scope questions;
  - CV text as data;
  - memory of 4 exchanges (page messages are not sent as exchanges);
  - live status and Stop;
  - the AI log.
- **FR-012**: Without on-device AI, the panel MUST still allow adding a posting and show page
  messages and cards. It MUST replace the composer with an explanation.
- **FR-013**: English and Spanish; WCAG 2.1 AA:
  - the panel is a labelled complementary region;
  - the sheet is a modal dialog with a focus trap;
  - the message list is a polite log;
  - no inline styles;
  - no horizontal scroll at 390 px.

### Key Entities

- **Conversation**: ordered messages, the posting text in context, held in memory.
- **Message**: user, assistant (AI) or page (computed). Assistant messages carry:
  - citations;
  - rewrites;
  - requested cards;
  - the version (report id) they were written against.
- **Page card**: fit, hard filters, keywords or gaps, rendered from the job match.

## Success Criteria *(mandatory)*

- **SC-001**: In scripted tests, 100% of figures shown in cards equal the Job match computation,
  whatever the model's text says.
- **SC-002**: No rewrite that adds a fact absent from the CV is shown (scripted tests, including
  posting terms).
- **SC-003**: From the results, a user reaches the chat in one action at any width, and asks a
  posting question in at most 3 actions after pasting the posting (paste → add → suggestion).
- **SC-004**: After dropping a new version, the conversation and the posting are still there in
  100% of scripted runs, with a change summary.
- **SC-005**: Off-topic and injection prompts from 005's set still get the refusal or leave the
  report unchanged.

## Assumptions

- The same on-device engine and tools; no new dependency or permission.
- One posting in context at a time; replacing it is enough (no comparison of several).
- The compact match (≤ ~2,500 characters) fits beside the report summary and 4 exchanges.
- The edit loop matches versions by order of analysis in the session, not by file name.
