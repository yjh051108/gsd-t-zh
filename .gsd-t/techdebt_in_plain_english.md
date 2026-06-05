# Tech Debt - Plain English

> Non-technical companion to .gsd-t/techdebt.md (Scan #12, 181 findings). One entry per item: what it is, why it matters, a real-world analogy, plain-urgency severity. Grouped by severity.

---

## 🔴 Critical (4)

### TD-113 - Core automation scripts crash immediately when run
**What it is.** The six automation scripts that power GSD-T's main workflows claim to run in a sandboxed environment (a restricted execution box), but each one opens with a command (`require()`) that the sandbox explicitly forbids. The sandbox throws a hard error the instant the script starts.
**Why it matters.** Every major GSD-T workflow - execute, verify, scan, debug, and more - is non-functional. The system appears to accept commands but silently fails, giving no useful output or progress.
**Real-world analogy.** It is like a vending machine that accepts coins and displays "dispensing" but has its motor disconnected - the process starts, then immediately stalls with no product and no refund.
**Severity.** fix before launch

### TD-114 - Parallel task execution silently falls back to single-threaded mode
**What it is.** When GSD-T tries to run multiple tasks at the same time (fan-out), it looks for a helper file that was deliberately deleted months ago. Because the file is missing, the system catches the error quietly and runs tasks one at a time instead, with no warning to the user.
**Why it matters.** A core selling point of GSD-T is parallel execution - doing more work in less time. This bug means that capability is permanently offline. Every job runs sequentially, making every workflow slower than advertised.
**Real-world analogy.** A restaurant promises a team of chefs working simultaneously on your order, but the head chef was let go and nobody told the kitchen - so one line cook handles every dish in sequence while the table waits.
**Severity.** fix before launch

### TD-115 - Removing a code review item crashes the review server
**What it is.** The review server has a handler that lets users exclude (remove) items from the review queue (the list of items awaiting review). That handler references a variable that was never created anywhere in the code. When the handler runs, it immediately crashes with a hard error.
**Why it matters.** Any attempt to exclude an item from a review session will crash that part of the server. Users cannot dismiss or skip review items, and repeated crashes can disrupt the entire review workflow.
**Real-world analogy.** An office filing system has an "archive" button that, when pressed, looks for a cabinet that was never installed - the button causes the whole desk to tip over instead of filing anything.
**Severity.** fix before launch

### TD-116 - The unattended (background) run commands reference deleted files and do nothing
**What it is.** The commands that launch and monitor GSD-T in unattended mode (running overnight or without user supervision) call on five helper files that were removed from the system months ago. When these commands are invoked, they immediately fail because the required files are gone.
**Why it matters.** Unattended mode - the ability to kick off a long job and walk away - is completely broken. Users who rely on background automation will see failures with no useful output or progress.
**Real-world analogy.** A building's after-hours security system tries to arm itself by contacting a monitoring company that closed down last year. The system appears to arm, but nothing is actually watching.
**Severity.** fix before launch

## 🟠 High (40)

### TD-117 - The quality-check workflow crashes before running a single check
**What it is.** The verify workflow - which runs all quality gates before approving work - uses the same sandboxed environment as the other workflows and makes the same forbidden calls at line 1. The very first line of the script fails, meaning no quality checks of any kind are performed.
**Why it matters.** Code and work products cannot be verified before delivery. The verify step that is supposed to catch bugs, security issues, and incomplete work silently does nothing, creating a false sense of safety.
**Real-world analogy.** A building inspector shows up, opens their checklist app, and the app crashes on launch - so they sign off on the building without looking at anything.
**Severity.** fix soon

### TD-118 - A user-supplied ID can read or overwrite files outside its designated folder
**What it is.** When GSD-T saves state for a running agent (automated worker), it builds a file path using an ID supplied by the user or an outside system. It does not check whether that ID contains navigation characters (like `../`) that could point the file path outside the safe folder.
**Why it matters.** In a shared or automated environment (such as a CI pipeline), a maliciously crafted agent ID could cause GSD-T to read or overwrite sensitive files anywhere on the machine, not just inside the project folder.
**Real-world analogy.** A hotel key card system lets guests type their own room number. A guest types "../manager-office" and the system cuts a key for the manager's office instead of a guest room.
**Severity.** fix soon

### TD-119 - The automated debug loop exits immediately on its first action
**What it is.** When GSD-T runs a debugging session in the background (headless mode), it spawns a sub-process (child instance) to do the actual work. One of those spawn calls is missing a required flag. Without that flag, the child process exits the moment it tries to use any tool.
**Why it matters.** The debug loop - the automated fix-and-retry cycle that is supposed to resolve issues without user intervention - silently stops working after its first action. Failures go unresolved and the user is not informed.
**Real-world analogy.** A repair robot is sent into a building to fix things, but its toolbox requires a passcode that nobody gave it. It opens the toolbox, gets rejected, and shuts down - leaving the repair undone.
**Severity.** fix soon

### TD-120 - A shared, guessable database password is baked into every installation
**What it is.** The password used to secure the local graph database is a fixed string hardcoded directly in the source code. Every user who installs this feature gets the same password on their machine, and it is publicly visible in the codebase.
**Why it matters.** Any process or person with network access to the machine can connect to the database using this known password. Sensitive project data stored in the graph - code relationships, dependencies, architecture - is exposed without authentication.
**Real-world analogy.** A storage facility sets every unit's lock combination to "1234" and prints it on the front door of the building. Every unit appears locked, but anyone who reads the sign can open any unit.
**Severity.** fix soon

### TD-121 - The safety check that prevents two teams from editing the same file only checks the last team listed
**What it is.** When GSD-T prepares to run multiple work domains (teams) in parallel, it runs a check to make sure no two teams will edit the same file at the same time. A bug in the argument parser means only the last team in the list is ever checked - all earlier teams are silently dropped from the safety scan.
**Why it matters.** Parallel teams can overwrite each other's changes without any warning. Work is lost, files end up in a broken state, and the merge conflict is discovered only after the fact.
**Real-world analogy.** A construction site requires teams to sign out rooms before working in them to prevent collisions. The sign-out sheet only records the last team to write their name - all previous entries are erased - so multiple crews end up in the same room at once.
**Severity.** fix soon

### TD-122 - The worker pool that actually runs parallel jobs has no automated tests
**What it is.** The component responsible for launching and managing parallel sub-processes (the worker pool executor) has no automated tests in the main test suite. Tests existed in a side branch but were never brought into the main codebase.
**Why it matters.** Bugs in this component - such as workers that fail silently, or jobs that never finish - have no safety net. Any change to the worker pool can break parallel execution without any automated warning.
**Real-world analogy.** A factory's assembly line has quality checks for every station except the conveyor belt itself. If the belt jams or runs backwards, nobody finds out until finished products stop arriving.
**Severity.** fix soon

### TD-123 - Six helper files that commands depend on do not exist
**What it is.** Six support files are called by command scripts to do things like log token usage, estimate context budget, and check session health. None of these six files exist in the codebase or the published package. Every command that calls them fails at that step.
**Why it matters.** Features including observability logging, context health warnings, and session checks are non-functional. Commands that depend on these files either crash or silently skip those steps, giving users an incomplete or misleading experience.
**Real-world analogy.** A car's dashboard has buttons labeled "GPS", "Heated Seats", and "Backup Camera" - but none of those modules were installed at the factory. Pressing the buttons does nothing.
**Severity.** fix soon

### TD-124 - When the quality gate crashes, it reports a false pass instead of a failure
**What it is.** If the parallel test runner inside the quality gate throws an error (crashes), the gate is supposed to report a failure. Instead, a quirk in the code means an empty result list is evaluated as "all checks passed" - a vacuously true result that signals success even though nothing ran.
**Why it matters.** Broken code or failed checks are approved as if they passed. Work that should be blocked from advancing moves forward, and quality problems go undetected until much later in the process.
**Real-world analogy.** A factory's final inspection station catches fire and shuts down. Instead of halting the line, the system marks every product "passed" because it has no failed inspections on record - an empty record counts as a clean record.
**Severity.** fix soon

### TD-125 - Fallback diagram renderer always draws a placeholder instead of the real diagram
**What it is.** When the primary diagram-drawing tool is unavailable, GSD-T falls back to a secondary tool. A bug in the fallback code means it always draws the same hardcoded placeholder image (`app -> db: query`) instead of the actual diagram it was given.
**Why it matters.** Architecture and data-flow diagrams in generated reports are meaningless stubs whenever the primary tool is absent. Users and stakeholders looking at documentation see a fake diagram that tells them nothing about the real system.
**Real-world analogy.** A photocopier's main tray runs out of paper and switches to the backup tray. But the backup tray was loaded with a single test page that gets printed every time, regardless of what the original document says.
**Severity.** fix soon

### TD-126 - Database schema reader assigns every column to every table
**What it is.** When GSD-T reads a database schema file to understand the data model, it scans the entire file for column definitions instead of scoping the scan to each table in turn. As a result, every table ends up listed as containing every column from every other table in the file.
**Why it matters.** Any feature that relies on schema understanding - such as architecture diagrams, documentation generators, or impact analysis - will show wildly incorrect and duplicated data. Decisions made from this output will be based on a distorted picture of the data model.
**Real-world analogy.** A library cataloguing system scans the entire building for book titles each time it processes a single shelf, then lists every book in the building as belonging to that shelf. Every shelf appears to contain the entire library.
**Severity.** fix soon

### TD-127 - Tech-debt summary readers look for an old format that no longer exists in output files
**What it is.** Two functions that extract tech-debt counts and priorities from scan output files search for a text pattern from a previous version of GSD-T. The scan tool now writes its output in a different format, so these readers find nothing and always return empty results.
**Why it matters.** Dashboards, reports, and status views that display tech-debt counts and severity breakdowns will show zero items even when the underlying scan found dozens of issues. Stakeholders are given a false "all clear."
**Real-world analogy.** A store's inventory system was programmed to read price tags printed in red ink. The supplier switched to black ink last year. Now the system counts zero items in stock no matter how full the shelves are.
**Severity.** fix soon

### TD-128 - Every graph database query takes 10 seconds because the connection is never reused
**What it is.** Each time GSD-T queries the graph database (which maps code relationships), it starts a brand-new database server process, asks one question, and then waits the full 10-second timeout for the process to quit on its own - because database servers are designed to stay running, not exit after one query.
**Why it matters.** Any workflow that makes multiple graph queries (architecture analysis, impact assessment, dead-code detection) is dramatically slower than it should be. A task that should complete in seconds can take minutes.
**Real-world analogy.** Every time a customer wants to check their bank balance, the teller opens a new branch location, processes the one request, and then waits for that branch to shut down before serving the next customer.
**Severity.** fix soon

### TD-129 - Saving graph data is not crash-safe - a mid-write failure corrupts the index silently
**What it is.** When GSD-T writes its code graph (a map of how files, functions, and components relate to each other), it saves eight separate files one after another. If the process is interrupted mid-way - by a crash, timeout, or forced shutdown - the files are left in a mismatched state with no indication anything went wrong.
**Why it matters.** The next time any graph-dependent feature runs, it reads a partially-updated index and produces incorrect results - stale relationships, missing data, or phantom entries - without warning. Debugging the resulting errors is difficult because the corruption is silent.
**Real-world analogy.** A library is updating its card catalogue by replacing cards one drawer at a time. If the librarian goes home mid-update, half the drawers have new cards and half have old ones. Anyone using the catalogue gets a mix of accurate and outdated information with no way to tell which is which.
**Severity.** fix soon

### TD-130 - Deleting a file does not mark its entries in the graph as stale
**What it is.** The staleness check that decides whether to re-index the code graph only looks at files that currently exist on disk. If a file was deleted since the last index run, it is simply absent from the check - so the graph is never flagged as out of date, and the deleted file's entries remain in the index forever.
**Why it matters.** Functions, components, and relationships from deleted files persist in the graph indefinitely. Dead-code reports, call-chain analysis, and dependency maps include phantom entries that no longer exist, making analysis results unreliable.
**Real-world analogy.** A city directory lists every business that was ever registered. When a business closes and removes its sign, the directory is never notified - so closed businesses remain listed as active indefinitely.
**Severity.** fix soon

### TD-131 - The safety filter for code searches can be bypassed with common filename characters
**What it is.** Before running a code search, GSD-T checks that the search term (entity name) contains only safe characters. The filter allows dots, slashes, and backslashes - which means terms like `../etc/passwd` (a path traversal attack) and regex wildcards (`.` matches any character in a search pattern) pass the check.
**Why it matters.** In a shared or CI environment, an attacker could craft an entity name that searches outside the project directory or matches unintended files. The safety filter provides false confidence while leaving the search open to misuse.
**Real-world analogy.** A building's visitor sign-in system checks that visitor names contain only "letters, dots, and dashes" - then a visitor writes "Mr. ../CEO-Office" and is waved through, because dots and dashes are allowed.
**Severity.** fix soon

### TD-132 - Database queries can be injected through an unsanitized user input field
**What it is.** One code path accepts a raw database query string from the caller and runs it against the graph database without any filtering or validation. A second path inserts a user-supplied number directly into a query template without checking that it is actually a number.
**Why it matters.** Anyone who can influence those inputs - through a UI field, an API call, or a config value - can run arbitrary database commands, including ones that delete all data. This is a classic injection vulnerability (similar in concept to SQL injection).
**Real-world analogy.** A bank teller accepts handwritten withdrawal slips and processes whatever amount is written, including slips that say "withdraw all funds from every account" - because no one checks whether the slip makes sense before acting on it.
**Severity.** fix soon

### TD-133 - The review proxy scrambles compressed web pages before injecting its overlay
**What it is.** When the review server proxies pages from the development web server, it receives pages in compressed form (like a zip file). It removes the label that says the content is compressed, but never actually decompresses it before trying to modify the HTML. The result is that the injected review overlay is added to a block of garbled binary data.
**Why it matters.** The review interface - the overlay that lets reviewers annotate and interact with the UI - does not render correctly on any page that the upstream server sends in compressed form. Reviews either show broken pages or fail entirely.
**Real-world analogy.** A postal worker is asked to add a sticky note to a document inside a sealed vacuum bag. Instead of opening the bag, they slap the sticky note on the outside of the bag and seal it back up. The recipient opens the bag and finds an unmarked document plus a loose sticky note that fell off.
**Severity.** fix soon

### TD-134 - A file-naming field in the review system can be manipulated to write files anywhere on disk
**What it is.** Review queue entries include an ID field that is used directly to construct file paths when saving feedback and queue state. There is no check to ensure the ID stays within the designated folder. An ID containing `../` sequences can navigate outside the intended directory.
**Why it matters.** A malicious or malformed review item could cause the server to write files anywhere on the host machine - overwriting system files, configuration, or other projects. This is a path traversal vulnerability.
**Real-world analogy.** A hotel's digital check-in assigns guests a room number from a form they fill in themselves. A guest types "../penthouse" and the system books them into the penthouse instead of a standard room, bypassing availability and pricing checks.
**Severity.** fix soon

### TD-135 - All generated UI component prompts assume Vue 3 regardless of the actual framework
**What it is.** The design orchestrator that generates prompts for building UI components hardcodes "Vue 3 + TypeScript" in every prompt, and defaults all file paths and conventions to Vue patterns. The system correctly detects the actual framework (React, Svelte, Angular) but never uses that information when building prompts.
**Why it matters.** On any non-Vue project, the AI receives incorrect instructions and generates Vue-specific code that does not work in the actual project. Developers must manually rewrite the output, defeating the purpose of the automation.
**Real-world analogy.** A contractor's bid software auto-fills every estimate form with "Victorian-style timber framing" regardless of whether the client wants a glass office tower or a concrete warehouse. Every estimate has to be corrected by hand before it can be used.
**Severity.** fix soon

### TD-136 - The dashboard auto-start feature calls a server file that does not exist
**What it is.** The component that automatically starts the GSD-T dashboard server references a JavaScript file that is not present in the codebase. When the auto-start function is called without an explicit port setting, it immediately throws a "file not found" error.
**Why it matters.** The dashboard - which provides visibility into running tasks and progress - cannot be started automatically. Any workflow or command that relies on auto-starting the dashboard will fail at that step.
**Real-world analogy.** A smart home hub is programmed to turn on the security camera system at sunset, but the camera app was uninstalled. Every evening the hub tries to launch the app, gets an error, and the cameras stay dark.
**Severity.** fix soon

### TD-137 - The data ingestion endpoint can be overwhelmed by a large or slow sender
**What it is.** The endpoint that receives streaming data (such as token counts or event logs) accumulates all incoming bytes in memory with no size limit. A sender that streams very slowly or never stops can cause the server to consume all available memory until it crashes.
**Why it matters.** Even a local process that misbehaves (a runaway loop, a stuck pipe) can bring down the entire GSD-T server process, interrupting any work in progress and losing state.
**Real-world analogy.** A warehouse receiving dock accepts deliveries of any size with no loading-bay capacity limit. A truck that never stops unloading eventually fills the entire warehouse floor, the parking lot, and the street, blocking all other operations.
**Severity.** fix soon

### TD-138 - The WebSocket disconnect message breaks the protocol specification when the reason text is long
**What it is.** WebSocket (a real-time communication protocol used by the dashboard) has a rule that disconnect ("close") messages must be at most 125 bytes long. The code that sends these messages writes the length directly without enforcing this limit, producing malformed messages when the reason text is long.
**Why it matters.** Strict WebSocket clients (browsers, proxies, monitoring tools) will reject or drop malformed close frames, potentially causing connections to hang instead of closing cleanly. This can leave stale connections open and cause resource leaks.
**Real-world analogy.** A walkie-talkie system has a rule that sign-off messages must be 10 words or fewer. An operator sends a 30-word sign-off, and some radios that strictly enforce the rule lock up waiting for a properly formatted sign-off that never comes.
**Severity.** fix soon

### TD-139 - Token usage tracking silently does nothing because it reads the wrong columns
**What it is.** The function that updates the token usage log reads column positions based on a 12-column table format. The actual log file has 11 columns in a different order. Every update attempt reads the wrong data, finds no matching row, and exits without writing anything.
**Why it matters.** Token usage is never aggregated or attributed to tasks. Dashboards, reports, and cost tracking that depend on this data show incorrect or empty figures. The log file exists but stays perpetually stale.
**Real-world analogy.** A spreadsheet formula references column M for sales totals, but the actual sales column is column L. Every calculation returns zero, and the sales dashboard shows the company made nothing - while actual sales go unrecorded.
**Severity.** fix soon

### TD-140 - The token log file grows without bound, duplicating all rows on every update
**What it is.** The tail-mode token aggregator is supposed to append only new rows to a file as new task groups appear. Instead, it appends all current rows every time any change occurs. After ten updates, the file contains 55 rows instead of 10, with early rows repeated many times.
**Why it matters.** Token usage reports are inflated and inaccurate. Storage grows unboundedly during long workflows. Any downstream analysis of the file (cost attribution, usage trends) produces wrong results because of the duplicated data.
**Real-world analogy.** A timesheet system is supposed to add one new line per employee per day. Instead, every time a new employee clocks in, it reprints every previous employee's line again. By Friday the timesheet has hundreds of entries instead of five.
**Severity.** fix soon

### TD-141 - A typo in a pattern-matching rule causes success criteria to be missed at the end of a document
**What it is.** A regular expression (a text-matching rule) used to extract "success criteria" from milestone charter files contains `\Z`, which in JavaScript is not a special end-of-document marker but is literally the character "Z". When the success criteria section is the last section in a file, the rule fails to match it, and the criteria are silently omitted.
**Why it matters.** Context briefs generated for domain workers are missing their success criteria when those criteria appear at the end of the charter. Workers proceed without knowing the definition of done, making it harder to verify that work is complete.
**Real-world analogy.** A checklist scanner is programmed to stop reading at the word "END" or the letter "Z". Any checklist whose last item doesn't happen to contain "Z" is scanned as incomplete, and the final items are never recorded.
**Severity.** fix soon

### TD-142 - A pre-commit safety hook calls a deleted command and blocks every commit on projects that install it
**What it is.** A git pre-commit hook (a script that runs automatically before each code commit) calls a GSD-T subcommand (`capture-lint`) that was removed from the system months ago. Because the command no longer exists, it always returns an error, and the hook fails - blocking the commit entirely.
**Why it matters.** Any project that has this hook installed cannot commit any code. All developers on that project are blocked from saving their work to source control until the hook is manually disabled or fixed.
**Real-world analogy.** A building's door lock system is programmed to call a verification service before unlocking. The verification service was shut down six months ago. Now every door on the floor is permanently locked, and nobody can get in or out without bypassing the system manually.
**Severity.** fix soon

### TD-143 - The journey coverage detector assigns unstable IDs to observers, breaking coverage tracking
**What it is.** When GSD-T scans for mutation observers (components that watch for DOM changes in the UI), it increments a counter before checking whether an observer should be excluded. Excluded observers consume a counter slot without producing output, shifting the IDs of all subsequent observers. If excluded observers are added or removed later, all downstream observer IDs change.
**Why it matters.** Coverage reports become unstable - the same observer gets a different ID depending on what other observers happen to be in the file. This causes false positives ("coverage lost") and false negatives ("coverage gained") whenever the file changes.
**Real-world analogy.** A concert venue assigns seat numbers sequentially as tickets are printed, but VIP seats (which are excluded from public sale) still consume a number. When a VIP row is added or removed, every seat after it shifts by a row, and existing tickets no longer match their physical seats.
**Severity.** fix soon

### TD-144 - The E2E test helper that replays sessions crashes immediately because it loads deleted files
**What it is.** A test fixture helper used in end-to-end tests (automated tests that simulate real user flows) tries to load two server files at startup that were deleted in a previous cleanup. The moment any test calls `startReplayServer()`, it throws a "file not found" error before any test logic runs.
**Why it matters.** Any end-to-end test suite that uses `startReplayServer()` cannot run at all. This blocks automated quality checks for features that depend on session replay, and the failure is misleading because it looks like a server error rather than a missing file.
**Real-world analogy.** A flight simulator training program tries to load a co-pilot module that was removed in the last software update. Every time a trainee starts a session, the simulator crashes before they can touch any controls.
**Severity.** fix soon

### TD-145 - The model selection rules disagree with the official contract, and several phases have no rule at all
**What it is.** GSD-T has a documented contract specifying which AI model to use for each workflow phase (for example, using the most capable model for planning because a bad plan causes cascading rework). The actual code assigns the wrong model to "plan" and has no rule at all for four other phases, so they silently fall back to a default.
**Why it matters.** Planning, impact analysis, milestone completion, and scan phases run on a less capable model than the contract requires, or on whatever default happens to apply. Work quality in these high-stakes phases is lower than the system's own documented standard.
**Real-world analogy.** A hospital protocol says senior surgeons must lead high-risk procedures. The scheduling system was coded to assign any available surgeon - and nobody noticed the mismatch. High-risk operations are quietly being led by whichever surgeon is free, not the most experienced one.
**Severity.** fix soon

### TD-146 - Stack-specific coding rules are never injected into the Workflow execution system
**What it is.** GSD-T is documented to automatically detect the project's technology stack (React, TypeScript, Python, etc.) and inject relevant best-practice rules into every AI worker prompt. This injection logic exists in an older part of the system but was never wired into the new Workflow execution scripts introduced in a recent major update.
**Why it matters.** All domain workers in Workflow-based execution operate without stack-specific guardrails. React-specific, TypeScript-specific, or Python-specific rules are silently absent, increasing the likelihood of stack-inappropriate code or patterns being generated.
**Real-world analogy.** A staffing agency promises to brief temporary workers on each client's specific workplace rules before they start. When the agency switched to a new scheduling system, the briefing step was never connected to the new workflow. Workers now show up with no client-specific instructions.
**Severity.** fix soon

### TD-147 - The backlog query API always returns zero items because it reads the wrong file format
**What it is.** The function that reads and returns backlog items searches for pipe-separated table rows (an old format). The actual backlog file uses a heading-based format with no table rows. Because the format does not match, the function always returns an empty list regardless of how many items exist.
**Why it matters.** Dashboards, status commands, and brief generators that query the backlog always see it as empty. Users and automated workflows cannot get a programmatic view of outstanding work, making backlog-driven automation non-functional.
**Real-world analogy.** A grocery store's inventory app is programmed to read price tags with barcodes. The store switched to QR codes last year. The app now reports every shelf as empty because it cannot read any of the current tags.
**Severity.** fix soon

### TD-148 - Removing the default app from backlog settings silently breaks all future backlog additions
**What it is.** When a user removes an app from the backlog settings, the system warns about existing backlog entries that use that app but never checks whether the app being removed is also set as the default. After removal, any attempt to add a new backlog item without specifying an app fails immediately, with no explanation of what happened.
**Why it matters.** After this sequence of actions, new backlog items cannot be added until the user discovers and manually fixes the default app setting. There is no warning at removal time, so the root cause is non-obvious.
**Real-world analogy.** A restaurant lets managers remove menu items. A manager removes the item set as the "daily special" - but the ordering system is not notified. From then on, every time a waiter tries to ring up a daily special order, the system rejects it with a generic error.
**Severity.** fix soon

### TD-149 - Promotion System That Never Actually Promotes Anything
**What it is.** The system has a five-stage process for "graduating" improvements (patches) from experimental to permanent, but two of those stages are never triggered, so every improvement stays permanently stuck at stage one, as if you built a conveyor belt but left two sections missing.
**Why it matters.** No improvement ever gets officially applied or measured, meaning the system cannot tell which fixes are working and which are not - the entire promotion process is theater.
**Real-world analogy.** Like a job application pipeline where candidates get screened and interviewed but the "send offer letter" and "onboard" steps were never wired up, so no one ever actually gets hired.
**Severity.** Fix soon

### TD-150 - Improvements Can Never Fully Graduate Due to a Catch-22
**What it is.** To be permanently approved, an improvement needs three checkpoints recorded after it advances to the next stage - but the system stops recording checkpoints the moment it advances, so the count can never reach three.
**Why it matters.** Any improvement that was approved with the minimum required evidence will be permanently stuck just short of the finish line, meaning nothing ever fully graduates.
**Real-world analogy.** Like a loyalty card that requires 3 stamps after your 10th purchase to earn a free coffee - but the cashier's stamp stops working after your 10th visit, so the card can never be completed.
**Severity.** Fix soon

### TD-151 - The Scoring System Rewards the Wrong Direction for Half the Metrics
**What it is.** When measuring whether an improvement worked, the system always treats "higher number" as better. For metrics where lower is better (like how many times something had to be fixed), the math is backwards - a worsening result looks like a win, and a genuine improvement looks like a failure.
**Why it matters.** The system will approve harmful changes and reject beneficial ones for any "lower is better" metric, making automated quality decisions actively misleading.
**Real-world analogy.** Like a golf scoring app that treats a lower round as a loss - a player who shot 68 instead of 80 would be told they performed worse, while someone who shot 100 gets flagged as improving.
**Severity.** Fix soon

### TD-152 - The Auto-Update Check is Broken Due to a Typo
**What it is.** A small syntax mistake (a misplaced character in a short code snippet) causes the version-checking script to crash silently every time it runs, so the system never knows whether a newer version is available.
**Why it matters.** Users never see update notifications, meaning they stay on outdated versions indefinitely without knowing it - the update system is completely non-functional.
**Real-world analogy.** Like a "check for updates" button that silently does nothing because the server address was mistyped - you keep clicking it thinking you are up to date, but the check never actually runs.
**Severity.** Fix soon

### TD-153 - The Date Guard Rejects Valid Historical Records as Forgeries
**What it is.** A safety check that ensures timestamps in log files are recent also incorrectly rejects old historical entries (like records from 2024) when an entire log file is being rebuilt, treating them as wrong even though they are legitimately from the past.
**Why it matters.** Commands that reconstruct or populate a project's history log are blocked from running, preventing accurate historical records from being written at all.
**Real-world analogy.** Like a notary who refuses to certify a photocopy of a 1995 contract because the date on it is not within the last five minutes - the check is well-intentioned but applied to the wrong context.
**Severity.** Fix soon

### TD-154 - The Performance Scorecard Display Shows Blanks Because the Data File Is Never Created
**What it is.** The metrics dashboard reads from a summary file that is supposed to track project performance over time, but no part of the system ever writes that file - so the dashboard sections that show trends, scores, and breakdowns are permanently empty.
**Why it matters.** Teams cannot see milestone performance trends, domain breakdowns, or quality scores - the metrics features users might rely on for decisions are silently non-functional.
**Real-world analogy.** Like a car dashboard that has a fuel economy display, but the sensor that feeds it was never connected - the screen is there, the display logic works, but it always shows nothing.
**Severity.** Fix soon

### TD-155 - The Official List of Supported Modes Is Six Items Short
**What it is.** A reference document (the "contract") says the system supports 6 operating modes, but the actual software now supports 11 - 5 modes were added but never added to the official list, meaning the list is actively misleading.
**Why it matters.** Anything that relies on the official list to validate inputs (such as automated checks or onboarding tools) would incorrectly reject valid requests for the 5 unlisted modes.
**Real-world analogy.** Like a restaurant menu that lists 6 dishes but the kitchen can actually make 11 - servers told to only offer menu items will turn away customers asking for the 5 unlisted dishes that are available.
**Severity.** Fix soon

### TD-156 - The Official Rulebook for Project Status Files Is Missing Three Rules
**What it is.** The specification document that describes how project status files must be formatted is missing the "ACTIVE" status label (which real files use), a column that appears in actual tables, and the required format for recording times with time zones.
**Why it matters.** Automated tools that validate project files against this specification will flag valid files as broken, and new projects generated from the spec will be missing required fields from the start.
**Real-world analogy.** Like a building code that specifies rules for kitchens and bathrooms but forgets to mention living rooms - inspectors following the code would fail buildings for having living rooms that don't match rules that don't exist yet.
**Severity.** Fix soon

### TD-273 - "Is the background task alive?" check misreads a permission error as a crash
**What it is.** The watch command that monitors background (unattended) tasks checks whether a process is still running by sending it a harmless signal. If the operating system says "you don't have permission to check that," the code treats it as "the process is dead" - when it actually means "the process is alive but owned by someone else."
**Why it matters.** A supervisor task running under a different user account (e.g., a shared server or elevated process) would be falsely reported as crashed, potentially triggering unnecessary restarts or alerts.
**Real-world analogy.** Like a security guard who, unable to see through a frosted-glass office door, assumes the room is empty rather than concluding someone is inside with privacy mode on.
**Severity.** Clean up eventually

### TD-274 - Corrupt status file causes the watch command to loop silently forever
**What it is.** If the file that records the background task's status is temporarily unreadable or corrupted, the watch command ends up in a state where none of its decision steps match. It quietly reschedules itself and waits again, showing no output and giving the user no indication that something is wrong.
**Why it matters.** A transient disk or write issue during an unattended run could cause the watch loop to spin indefinitely with no alert, making the session appear healthy when it is actually stuck.
**Real-world analogy.** Like an answering service that, upon receiving a garbled message, re-queues the call indefinitely rather than flagging it as unreadable and notifying the recipient.
**Severity.** Clean up eventually

### TD-275 - Milestone completion check can match the wrong milestone when names are short
**What it is.** When the unattended-watch command checks whether a milestone has been archived, it searches by looking for the milestone name anywhere inside an archive folder name. A short name like "M5" would accidentally match archived milestones named "M55," "M57," or "M51," potentially declaring the wrong milestone complete.
**Why it matters.** A false-positive completion report could cause the tool to move on and dismiss work that has not actually finished, or to skip re-launching a task that still needs to run.
**Real-world analogy.** Like a shipping tracker that marks a package "delivered" because it found "order 5" as a substring in order 55's delivery confirmation - the wrong package is marked done.
**Severity.** Clean up eventually

### TD-276 - A specially crafted event name could write files outside the intended log folder
**What it is.** The in-session probe hook names log files using a value it receives from the environment without checking whether that value contains a folder separator character. A value like "Stop/evil" would cause the file to be written one directory level deeper than intended, creating unexpected sub-folders.
**Why it matters.** Although the path is still technically inside the probe directory, creating unintended sub-folders breaks log rotation, cleanup scripts, and any tooling that expects a flat file layout.
**Real-world analogy.** Like a hotel key card system that accepts room numbers as free text - a guest entering "101/manager" could end up with access to both room 101 and the manager's floor.
**Severity.** Clean up eventually

### TD-277 - A completion signal can be sent twice in certain error conditions
**What it is.** When a subprocess (a helper program) fails to start, two different error-handling paths both try to report the result at the same time. In JavaScript, once a result has been reported the second report is silently dropped, but the underlying race condition is fragile and could behave unexpectedly if the code is modified.
**Why it matters.** While currently harmless (JavaScript discards the second signal), the race condition makes the code brittle - a future change to error handling could turn the duplicate signal into a real bug.
**Real-world analogy.** Like two customer-service agents both calling the same customer to confirm the same order cancellation - usually one just gets voicemail, but if the customer answers both calls they might cancel two orders instead of one.
**Severity.** Clean up eventually

### TD-278 - Inline-event detector misses onclick handlers that appear after the first closing angle bracket in a tag
**What it is.** The tool that scans HTML for inline event handlers (code written directly into page elements) uses a pattern that stops reading as soon as it hits the first ">" character. A tag that uses ">" inside a quoted attribute value before the onclick handler would cause the handler to be missed.
**Why it matters.** Journey-coverage reports would undercount inline handlers, giving an overly optimistic picture of how thoroughly user interactions are tracked.
**Real-world analogy.** Like a building code inspector who stops reading a floor plan at the first staircase symbol and misses any fire exits drawn after it.
**Severity.** Clean up eventually

### TD-279 - Browser-storage test cleanup can never actually run from the command line
**What it is.** The automated test-data cleanup system has an adapter for clearing browser local storage (data stored in the browser between sessions). Cleaning browser storage requires an active browser session. The command-line cleanup tool never provides one, so every browser-storage cleanup entry is silently marked "skipped" instead of actually being removed.
**Why it matters.** Test data tagged for browser-storage cleanup accumulates indefinitely when cleanup is run from the command line, potentially polluting test environments over time.
**Real-world analogy.** Like a cleaning crew that is assigned to wipe whiteboards but only works when the office is open - any boards scheduled for overnight cleaning are simply left untouched with a "skipped" note.
**Severity.** Clean up eventually

### TD-280 - A Windows metadata file is bundled into every published release of the npm package
**What it is.** A Windows-generated system file called "desktop.ini" (used by Windows Explorer to customize folder appearance) was accidentally committed to the repository. It is excluded from the project's ignore list on paper, but because it was committed before the ignore rule existed, git still tracks it and includes it in every npm package release.
**Why it matters.** The file slightly increases the published package size and looks unprofessional to anyone inspecting the package contents. It needs to be explicitly untracked to fix it.
**Real-world analogy.** Like a publisher who accidentally included a Post-it note from the author's desk in every printed copy of the book - harmless, but embarrassing and wasteful.
**Severity.** Clean up eventually

### TD-281 - A model-selection utility that is built, tested, but never actually used
**What it is.** There is a module designed to select which AI model tier to use for different tasks. It has tests and is listed in documentation, but no part of the actual tool imports or calls it. Model selection is instead done by hand in each workflow script separately.
**Why it matters.** The module gives a false impression of centralized model governance. Any update to model selection logic must be done manually in each workflow script rather than in one place.
**Real-world analogy.** Like a company that built a centralized HR system for assigning staff to projects, but every department manager still maintains their own spreadsheet and ignores the system.
**Severity.** Clean up eventually

### TD-282 - AI context summaries miss contracts referenced in task and constraint files
**What it is.** When preparing a briefing document for an AI worker, the tool looks for references to design contracts only in the main scope file. References to the same contracts inside the task list or the constraints file are never picked up.
**Why it matters.** The AI worker's briefing is incomplete - it may not know about relevant contracts, leading to outputs that violate agreed interfaces without any warning.
**Real-world analogy.** Like a project manager who briefs a contractor by reading only the project overview document, skipping the technical specifications and compliance requirements that were referenced in the task checklist.
**Severity.** Clean up eventually

### TD-283 - The help documentation for one command omits a file it actually reads
**What it is.** The help entry for the "backlog settings" command lists only one file it works with. In practice, three of its sub-commands also read the main backlog file - but that file is not mentioned in the help entry.
**Why it matters.** Anyone checking the help to understand which files might be locked or need backing up before running the command would have an incomplete picture.
**Real-world analogy.** Like a car service checklist that says "replace the oil filter" but does not mention it also requires draining the oil - the mechanic arrives with the filter but no drain pan.
**Severity.** Clean up eventually

### TD-284 - The "--top N" filter in backlog list accepts nonsensical values with no warning
**What it is.** The command for listing backlog items has a "show top N items" option. There is no validation that N is a positive whole number. Passing zero, a negative number, or a word produces undefined behavior.
**Why it matters.** A user or script passing an invalid value gets no error message and may receive confusing or empty results with no explanation.
**Real-world analogy.** Like a coffee machine with a cup-size dial that accepts positions beyond "large" - it may overflow, do nothing, or behave unpredictably, with no indicator that the setting is invalid.
**Severity.** Clean up eventually

### TD-285 - Two self-referential step instructions in the milestone-completion workflow
**What it is.** In the complete-milestone command document, one step says "proceed to Step 2" while the reader is already in Step 2. A second step references "Step 4" for a summary, but the summary is actually created in Step 5. Both are broken internal navigation instructions.
**Why it matters.** Anyone following the workflow manually or auditing it will be confused and may skip the correct next step or look for content in the wrong place.
**Real-world analogy.** Like a recipe that says "once the sauce is ready, proceed to Step 3" from inside Step 3 itself - the cook does not know whether to re-read the step or move on.
**Severity.** Clean up eventually

### TD-286 - The init guide references a step number that does not exist
**What it is.** In the project initialization command document, Step 12 refers the reader to "Step 7.6" for Playwright (browser testing tool) setup instructions. There is no Step 7.6; the actual Playwright setup is in Step 11.
**Why it matters.** Anyone following the init guide to verify test infrastructure setup will not find Step 7.6 and may assume setup was skipped or that the guide is out of date.
**Real-world analogy.** Like an assembly manual that says "refer to diagram 7.6" when the manual only goes up to diagram 7.4 - the assembler stops, confused, unsure whether they missed a page.
**Severity.** Clean up eventually

### TD-287 - Re-running the project setup on the same day silently overwrites the previous backup
**What it is.** When the init-scan-setup command finds an existing tech-debt file, it archives it with only the date in the filename (no time). If the command is run twice in one day, the second run writes over the first archive without warning.
**Why it matters.** A user who re-runs setup to try different settings loses the first archive permanently, with no indication it was overwritten.
**Real-world analogy.** Like a document management system that saves backups named only by date - running "backup" twice on Tuesday overwrites Tuesday's first backup with no version history.
**Severity.** Clean up eventually

### TD-288 - The update-available banner shows the current version twice instead of old and new
**What it is.** When an auto-update fails and the tool displays a notice, the banner is supposed to show "current version - update available: new version." Instead it shows the current version in both positions, making the message read "v4.0.12 - update available (v4.0.12 - v4.0.13)" - the installed version appears twice.
**Why it matters.** The redundant display is confusing and looks like a bug to the user; it reduces confidence in the update mechanism.
**Real-world analogy.** Like a software update dialog that reads "You are running version 12. Update to version 12 (latest: 13)?" - technically correct but clearly something is wrong.
**Severity.** Clean up eventually

### TD-289 - Preflight check reads the entire task history file into memory every time it runs
**What it is.** Every time the tool runs its startup preflight check, it reads the complete history of all tasks ever recorded (a file that grows with every milestone) into memory all at once. It then only uses the last 10 records. There is no limit on how large this file can grow.
**Why it matters.** On a long-running project with many milestones, this file could become very large, causing a noticeable delay on every tool invocation even for simple commands.
**Real-world analogy.** Like a cashier who, before ringing up each customer, reads the entire transaction log going back to the store's opening day just to find yesterday's last ten receipts.
**Severity.** Clean up eventually

### TD-290 - Git commands are assembled using string substitution - unusual branch names could cause unintended behavior
**What it is.** The tool builds git command strings by inserting branch names and dates directly into the command text using quoted substitution. While the quoting protects against simple cases, a branch name containing embedded quotes or special characters could break out of the intended command structure.
**Why it matters.** In practice, branch names follow predictable conventions so this is very unlikely to be exploited. However, the pattern is a known security anti-pattern and should use argument arrays instead of string assembly.
**Real-world analogy.** Like a receptionist who reads a visitor's name aloud to unlock a voice-activated door - works fine for "John Smith" but breaks if a visitor says their name is 'John" open all doors Smith'.
**Severity.** Clean up eventually

### TD-291 - 33 leftover workspace folders from completed milestones were never cleaned up
**What it is.** After a milestone is completed and archived, the GSD-T tool is supposed to remove the working directories it created for that milestone. Milestones M43 through M65 were all archived successfully, but their 33 working directories are still sitting in the active workspace folder.
**Why it matters.** The clutter makes it harder to find which domains belong to the current active milestone. Any tooling that counts or lists active domains gets inflated numbers.
**Real-world analogy.** Like a project management board where completed sprint sticky notes are moved to the "done" column but never physically removed - after a year the board is covered in old notes and the active sprint is hard to find.
**Severity.** Clean up eventually

### TD-292 - The contract document for the background supervisor describes a system that no longer exists
**What it is.** There is a 639-line contract document defining how the unattended background supervisor should work. The actual code it describes was deleted in a previous milestone (M61). The document still refers to deleted files and describes behaviors that have since been replaced by a completely different mechanism.
**Why it matters.** Any developer or AI agent reading this contract to understand how unattended mode works will follow outdated specifications, potentially rebuilding the old system instead of working with the current one.
**Real-world analogy.** Like an operations manual that still describes how to operate machinery that was replaced three years ago - it looks authoritative, but following it would mean working on equipment that no longer exists.
**Severity.** Clean up eventually

### TD-293 - Project status documents still point to a retired tracking file
**What it is.** Two official project guideline documents ("contracts" - written agreements about how parts of the system work) still reference a specific status file that was planned for deletion during a previous cleanup effort but was never actually removed.
**Why it matters.** When the team follows these outdated documents, they may build new features that depend on a file that no longer exists or should not exist - leading to broken features or wasted rework when the cleanup eventually happens.
**Real-world analogy.** Your office policy manual still tells employees to file expense reports in the "red folder bin" in room 204, but that bin was removed during last year's office reorganization - nobody updated the manual, so new hires keep going to an empty corner looking for something that isn't there.
**Severity.** Clean up eventually

