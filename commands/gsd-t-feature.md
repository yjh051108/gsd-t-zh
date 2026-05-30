# GSD-T: Feature — Add a Major Feature to an Existing Project

You are the lead agent planning a significant new feature for an existing codebase. Unlike `/gsd-t-project` (greenfield), this command respects and builds on what already exists — existing patterns, schema, auth, conventions, and contracts.

## Step 0.5: Scan Freshness Auto-Refresh

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-feature --step 0 --step-label ".5: Scan Freshness Auto-Refresh" 2>/dev/null || true
```

Before reading scan data for impact analysis, check if scan docs are stale and auto-refresh if needed. This ensures feature planning is based on current code — no warnings, no user involvement.

If `.gsd-t/scan/.cache.json` exists:
1. Read the cache and check `scannedAt` for each dimension
2. Count commits since the scan: `git rev-list --count --after="{scannedAt}" HEAD`
3. If **>10 commits since scan** OR **scan is older than 14 days**:
   - Log: "Auto-refreshing the tech-debt register (stale by {N} commits / {N} days)..."
   - Re-run the scan by invoking the volume-scaled scan Workflow (`templates/workflows/gsd-t-scan.workflow.js`, same as `/gsd-t-scan`) — the probe re-slices the codebase and the finders refresh the register. This replaces the retired fixed-dimension teammate refresh.
4. If fresh → proceed silently

If `.gsd-t/scan/` doesn't exist at all → skip (no scan data to refresh).

## Step 1: Understand What Exists

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-feature --step 1 --step-label "Understand What Exists" 2>/dev/null || true
```

Read everything:
1. `CLAUDE.md` — project conventions, stack, patterns
2. `.gsd-t/progress.md` — completed milestones, decision history
3. `.gsd-t/roadmap.md` (if exists) — original project plan
4. `.gsd-t/contracts/` — existing contracts (these are constraints now)
5. `.gsd-t/domains/` — existing domain boundaries
6. `.gsd-t/techdebt.md` (if exists) — known issues that might interact
7. `docs/` — requirements, architecture, schema
8. Source code — scan the actual implementation:
   - Directory structure and organization patterns
   - Existing API endpoint patterns
   - Database schema (current state)
   - UI component patterns and state management approach
   - Auth/middleware patterns
   - Test patterns and coverage

Build a mental model of: "How does this codebase work today?"

**Multi-Client Architecture Check**: Before moving to Step 2, identify whether the project has or will have multiple consumer surfaces:
- Look for directories: `web/`, `mobile/`, `app/`, `cli/`, `client/`, `frontend/`
- Look for split route files: `routes/web.js`, `routes/mobile.js`, `routes/api/v1/`, `routes/api/v2/`
- Check package.json scripts for `build:web`, `build:mobile`, `start:mobile`, etc.
- Check `.gsd-t/scan/quality.md` (if exists) for the "Consumer Surfaces Detected" table

Note what you find — this informs Step 3's Multi-Consumer Check and Step 4's milestone ordering.

## Step 1.5: Graph-Enhanced Blast Radius Analysis

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-feature --step 1 --step-label ".5: Graph-Enhanced Blast Radius Analysis" 2>/dev/null || true
```

If `.gsd-t/graph/meta.json` exists (graph index is available):
1. Query `getSurfaceConsumers` and `getCallers` on functions likely affected by the feature to calculate blast radius across all consumer surfaces
2. Query `getTransitiveCallers` for deep impact chains that may not be obvious from architecture docs alone
3. Feed these findings into the Impact Analysis in Step 3

If graph is not available, skip this step.

## Step 2: Understand the Feature

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-feature --step 2 --step-label "Understand the Feature" 2>/dev/null || true
```

From $ARGUMENTS and conversation:
- What does this feature do?
- Who uses it?
- How does it interact with existing functionality?
- What's the priority / timeline pressure?

If context is thin, ask targeted questions:
- How should this integrate with existing auth/permissions?
- Does this need new database tables or extend existing ones?
- Are there new third-party integrations?
- Does this affect existing UI flows or is it a new section?
- Any existing features this replaces or modifies?

## Step 3: Impact Analysis

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-feature --step 3 --step-label "Impact Analysis" 2>/dev/null || true
```

Before planning milestones, analyze how this feature touches the existing system.

### Team Mode (recommended for large codebases)
If agent teams are enabled, parallelize the analysis by layer:

```
Create an agent team to analyze the impact of this feature:

ALL TEAMMATES read first:
- CLAUDE.md
- .gsd-t/contracts/ (all existing contracts)
- docs/ (requirements, architecture, schema)
Feature description: {feature summary from Step 2}

- Teammate "data-layer": Analyze impact on database schema, 
  migrations, models, data access patterns. What tables/columns 
  are new? What existing queries break? Write to .gsd-t/scan/feature-impact-data.md

- Teammate "backend": Analyze impact on API endpoints, services,
  middleware, business logic. What's new? What existing endpoints 
  change? What contracts are affected? Write to .gsd-t/scan/feature-impact-backend.md

- Teammate "frontend": Analyze impact on UI components, pages, 
  navigation, state management. What's new? What existing flows 
  change? Write to .gsd-t/scan/feature-impact-frontend.md

- Teammate "security": Analyze impact on auth flows, permissions,
  input validation, data exposure. Any new attack surface? 
  Write to .gsd-t/scan/feature-impact-security.md

Lead: Synthesize all impact findings into the combined analysis below.
```

### Solo Mode (small codebases or teams not enabled)
Work through each layer sequentially:

Produce a combined analysis:

```markdown
## Impact Analysis: {feature name}

### New Components (doesn't exist yet)
- {new API endpoints}
- {new database tables/columns}
- {new UI pages/components}
- {new services/integrations}

### Modified Components (exists, needs changes)
- {file/module}: {what changes and why}
- {file/module}: {what changes and why}

### Affected Contracts (existing contracts impacted)
- {contract}: {what needs to change}
  - Breaking change? {yes/no}
  - Consumers affected: {list}

### Untouched (confirmed no impact)
- {areas explicitly not affected}

### Risk Areas
- {where this feature could break existing functionality}
- {complex integration points}
- {performance concerns}

### Multi-Consumer Check
- Consumer surfaces that exist or will exist after this feature: {list}
- Does this feature add a new consumer surface? {yes/no}
- If yes: backend operations this new surface needs: {list}
- Of those, how many are already implemented for an existing surface? {list any matches}
- SharedCore extraction candidates (operations needed by 2+ surfaces): {list or "none found"}
- SharedCore milestone required? {yes — if 2+ candidates found | no — if none}
```

## Step 4: Decompose into Milestones

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-feature --step 4 --step-label "Decompose into Milestones" 2>/dev/null || true
```

The feature may be a single milestone or multiple, depending on scope:

### Single Milestone (if feature is focused):
- 2-4 domains, < 15 tasks total
- Minimal impact on existing contracts
- Skip roadmap, go straight to: "Run `/gsd-t-partition` to begin"

### Multiple Milestones (if feature is complex):
Apply these sequencing rules:

1. **Schema/data changes first**: New tables, migrations, model updates
2. **Backend before frontend**: API endpoints before UI that consumes them  
3. **Existing contract updates early**: If existing contracts change, update and verify them before building new code against them
4. **New functionality before integration**: Build the new thing, then wire it into existing flows
5. **Migration/backfill as its own milestone**: If existing data needs transformation, isolate that work
6. **SharedCore before new consumer surfaces**: If the feature adds a new consumer surface (web, mobile, CLI) AND SharedCore candidates were identified in Step 3's Multi-Consumer Check, add a SharedCore milestone BEFORE the new client's milestone. The SharedCore milestone extracts shared operations into a reusable backend domain — the new client's API calls SharedCore functions, it does not duplicate them.

### Write the Feature Roadmap

Append to `.gsd-t/roadmap.md` (or create if doesn't exist):

```markdown
---

## Feature: {feature name}
**Added**: {date}
**Context**: {why this feature is being added}

### Milestone {N}: {name} — Data Layer Extension
**Goal**: {what "done" looks like}
**Scope**:
- {new tables/columns}
- {schema migrations}
- {data model updates}
**Impact on existing**:
- Extends schema-contract.md with {new tables}
- No breaking changes to existing queries
**Success criteria**:
- [ ] {testable outcome}

### Milestone {N+1}: {name} — Feature Backend
**Goal**: {what "done" looks like}
**Scope**:
- {new API endpoints}
- {business logic}
- {integration with existing auth}
**Impact on existing**:
- Adds to api-contract.md: {new endpoints}
- Modifies: {existing middleware/routes}
**Success criteria**:
- [ ] {testable outcome}

### Milestone {N+2}: {name} — Feature UI + Integration
**Goal**: {what "done" looks like}
**Scope**:
- {new pages/components}
- {wire into existing navigation}
- {update existing UI where needed}
**Impact on existing**:
- Modifies: {existing components}
- Extends component-contract.md with {new components}
**Success criteria**:
- [ ] {testable outcome}
```

## Step 5: Reconcile with Existing State

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-feature --step 5 --step-label "Reconcile with Existing State" 2>/dev/null || true
```

Critical step — make sure the new milestones fit with what's already built:

1. **Check for conflicts**: Do new milestones conflict with in-progress work?
2. **Check for dependencies**: Do any existing incomplete milestones need to finish first?
3. **Check techdebt.md**: Are there known issues that should be fixed before or during this feature?
4. **Update domain boundaries**: Will existing domains need scope changes? Will new domains be created?

If conflicts exist, present them to the user with options:
- "Milestone 3 (existing) modifies the same auth middleware this feature needs. Should we complete M3 first, or merge the work?"

## Step 6: Update Project State

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-feature --step 6 --step-label "Update Project State" 2>/dev/null || true
```

Update `.gsd-t/progress.md`:
- Add new milestones to the table
- Log the feature addition in Decision Log
- Note any contract changes that will be needed

## Step 7: Document Ripple

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-feature --step 7 --step-label "Document Ripple" 2>/dev/null || true
```

After creating the feature roadmap and milestones, update all affected documentation:

### Always update:
1. **`.gsd-t/progress.md`** — Already done in Step 6, but verify Decision Log includes the feature addition with rationale

### Check if affected:
2. **`docs/requirements.md`** — Add new functional/technical requirements identified during feature analysis
3. **`docs/architecture.md`** — If the feature introduces new components, data flows, or architectural patterns, document them
4. **`docs/workflows.md`** — If the feature introduces new user journeys or modifies existing flows, update them
5. **`CLAUDE.md`** — If the feature establishes new conventions or patterns that future work should follow, add them
6. **`.gsd-t/contracts/`** — If impact analysis identified contract changes needed, note them (actual updates happen during partition)
7. **`.gsd-t/techdebt.md`** — If analysis revealed existing debt that interacts with this feature, add or update items

### Skip what's not affected.

## Step 8: Test Verification

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-feature --step 8 --step-label "Test Verification" 2>/dev/null || true
```

Before finalizing the feature plan:

1. **Run existing tests**: Execute the full test suite to confirm the codebase is in a clean state before feature work begins
2. **Verify passing**: If any tests fail, flag them — they must be fixed before or during the first milestone
3. **Note test gaps**: From the impact analysis, identify which existing tests will need updates and which new tests will be needed — include these in milestone scope

## Step 9: Report to User

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-feature --step 9 --step-label "Report to User" 2>/dev/null || true
```

Present:
1. Impact analysis summary (what's new vs. what's modified)
2. Milestone breakdown for the feature
3. Risk areas and how the milestones mitigate them
4. Any conflicts with existing work
5. Recommended starting point

Ask: "Ready to start? Run `/gsd-t-partition` for Milestone {N}."

$ARGUMENTS

## Auto-Clear

All work is committed to project files. Execute `/clear` to free the context window for the next command.
