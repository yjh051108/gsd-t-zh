#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { loadConfig } = require('./gsd-t-orchestrator-config.cjs');
const { readAllTasks, groupByWave, validateNoForwardDeps } = require('./gsd-t-orchestrator-queue.cjs');
const { runWorker } = require('./gsd-t-orchestrator-worker.cjs');
const { buildTaskBrief } = require('./gsd-t-task-brief.js');
// M61 D4: gsd-t-stream-feed-client retired. createStreamFeedClient connected
// the orchestrator to the dashboard's SSE stream. Native /workflows view
// replaces the dashboard surface. Stub to a no-op client.
const createStreamFeedClient = () => ({ publish: () => {}, close: () => {} });
// M61 D2: gsd-t-orchestrator-recover retired. The recover module reconciled
// in-flight orchestrator state for `--resume`. Native Workflow resume
// (resumeFromRunId) replaces it. The stub MUST match the call-site contract
// (gsd-t-orchestrator.js:327-356 reads .mode/.notes/.state/.tasks/.currentWave):
// return mode:'fresh' so `--resume` correctly raises NO_RESUME_STATE instead
// of silently re-running the whole milestone. (M61 post-audit HIGH fix —
// the prior {inFlight,tasks,milestone} shape had no .mode key, so every
// resume branch fell through and the orchestrator restarted from scratch.)
const recoverRunState = () => ({
  mode: 'fresh',
  notes: ['orchestrator-recover retired in M61 — use native Workflow resumeFromRunId for resume'],
  state: {},
  tasks: {},
  currentWave: null,
});
const writeRecoveredState = () => {};
const archiveState = () => ({ archived: false, archivePath: null });

const STATE_DIR = '.gsd-t/orchestrator';
const STATE_FILE = 'state.json';

function nowIso() { return new Date().toISOString(); }

function parseCliArgs(argv) {
  const args = {
    milestone: null,
    maxParallel: null,
    workerTimeoutMs: null,
    projectDir: process.cwd(),
    resume: false,
    noArchive: false,
    help: false,
    streamFeed: true,
    streamFeedPort: null,
    streamFeedHost: null
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { args.help = true; }
    else if (a === '--milestone') { args.milestone = argv[++i]; }
    else if (a === '--max-parallel') { args.maxParallel = argv[++i]; }
    else if (a === '--worker-timeout') { args.workerTimeoutMs = argv[++i]; }
    else if (a === '--project-dir') { args.projectDir = path.resolve(argv[++i]); }
    else if (a === '--resume') { args.resume = true; }
    else if (a === '--no-archive') { args.noArchive = true; }
    else if (a === '--no-stream-feed') { args.streamFeed = false; }
    else if (a === '--stream-feed-port') { args.streamFeedPort = Number(argv[++i]); }
    else if (a === '--stream-feed-host') { args.streamFeedHost = argv[++i]; }
  }
  return args;
}

function printHelp() {
  process.stdout.write([
    'Usage: gsd-t orchestrate --milestone <id> [options]',
    '',
    'Options:',
    '  --milestone <id>         Milestone id (e.g. M40). Required.',
    '  --max-parallel <n>       Max concurrent workers (default: adaptive by free RAM,',
    '                            1 worker per 2GB, floor 3, ceiling 15).',
    '  --worker-timeout <ms>    Per-worker timeout in ms (default 270000).',
    '  --project-dir <path>     Project directory (default cwd).',
    '  --resume                 Resume from .gsd-t/orchestrator/state.json.',
    '  --no-archive             When --resume + state is terminal, do NOT archive — fail instead.',
    '  --no-stream-feed         Disable pushing frames to local stream-feed server.',
    '  --stream-feed-port <N>   Override stream-feed port (default 7842 / env GSD_T_STREAM_FEED_PORT).',
    '  --stream-feed-host <H>   Override stream-feed host (default 127.0.0.1).',
    '  -h, --help               Show this help.',
    ''
  ].join('\n'));
}

function atomicWriteJson(fp, obj) {
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = fp + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, fp);
}

function appendEventLine(projectDir, event) {
  const dayStr = nowIso().slice(0, 10);
  const eventsDir = path.join(projectDir, '.gsd-t', 'events');
  if (!fs.existsSync(eventsDir)) fs.mkdirSync(eventsDir, { recursive: true });
  const fp = path.join(eventsDir, dayStr + '.jsonl');
  fs.appendFileSync(fp, JSON.stringify(event) + '\n');
}

function writeEvent(projectDir, eventType, extra) {
  const event = {
    ts: nowIso(),
    command: 'orchestrate',
    phase: null,
    trace_id: null,
    event_type: eventType,
    agent_id: process.env.GSD_T_AGENT_ID || null,
    parent_agent_id: process.env.GSD_T_PARENT_AGENT_ID || null,
    reasoning: null,
    outcome: null,
    ...(extra || {})
  };
  try { appendEventLine(projectDir, event); } catch (_) { /* best effort */ }
}

function makeState(projectDir) {
  const fp = path.join(projectDir, STATE_DIR, STATE_FILE);
  const defaults = {
    startedAt: nowIso(),
    status: 'running',
    currentWave: null,
    tasks: {}
  };
  return {
    fp,
    data: defaults,
    save(patch) {
      if (patch) Object.assign(this.data, patch);
      atomicWriteJson(this.fp, this.data);
    },
    patchTask(id, fields) {
      this.data.tasks[id] = { ...(this.data.tasks[id] || {}), ...fields };
      atomicWriteJson(this.fp, this.data);
    }
  };
}

function filterTasksByMilestone(tasks, milestone) {
  // M40 tasks don't yet carry a milestone field in tasks.md — for now,
  // the milestone context is global. This function is a placeholder for
  // when tasks.md entries include an explicit milestone marker.
  return tasks;
}

async function runWaveTasks({ tasks, config, state, logger, spawnImpl, runWorkerImpl = runWorker, onFrame, interrupt, liveChildrenRef, streamFeedFactory }) {
  const queue = [...tasks];
  const running = new Set();
  const results = [];
  const liveChildren = liveChildrenRef || new Map();
  let haltRequested = false;
  if (!interrupt) interrupt = { interrupted: false };

  const emit = (frame) => {
    if (typeof onFrame === 'function') { try { onFrame(frame); } catch (_) {} }
  };

  const launch = async (task) => {
    const started = nowIso();
    state.patchTask(task.id, { status: 'running', startedAt: started, retryCount: 0 });
    writeEvent(config.projectDir, 'task_start', { task_id: task.id, wave: task.wave, domain: task.domain });

    const canonicalTaskId = task.id.includes(':T')
      ? `${task.domain}-t${task.id.split(':T')[1]}`
      : task.id;
    const taskForWorker = { ...task, canonicalId: canonicalTaskId };

    const attempt = async (retryCount) => {
      let brief;
      try {
        brief = buildTaskBrief({
          milestone: config.milestone,
          domain: task.domain,
          taskId: canonicalTaskId,
          projectDir: config.projectDir,
          expectedBranch: config.expectedBranch || 'main'
        });
      } catch (err) {
        logger.log(`[orchestrator] brief build failed for ${task.id}: ${err.message}`);
        return {
          result: { ok: false, missing: ['brief_build_error'], details: { error: String(err) } },
          exitCode: -1,
          durationMs: 0,
          timedOut: false
        };
      }
      if (retryCount > 0) {
        brief += `\n\n## Retry Note\nPrevious attempt failed. Try again, paying attention to the Done Signal checklist.\n`;
      }

      // D1-T7: per-worker stream-feed client. Opens when we get a pid; every
      // onFrame call tees to both the user callback and the feed client so the
      // D4 server + UI see every frame.
      let feedClient = null;

      const teeFrame = (frame) => {
        emit(frame);
        if (feedClient) {
          try { feedClient.pushFrame(frame); } catch (_) { /* best-effort */ }
        }
      };

      const outcome = await runWorkerImpl({
        task: taskForWorker,
        brief,
        config,
        onFrame: teeFrame,
        onSpawn: ({ child, pid }) => {
          if (pid != null) {
            state.patchTask(task.id, { workerPid: pid });
            liveChildren.set(task.id, child);
            if (streamFeedFactory) {
              try {
                feedClient = streamFeedFactory({
                  workerPid: pid,
                  taskId: canonicalTaskId,
                  projectDir: config.projectDir
                });
              } catch (err) {
                logger.log(`[orchestrator] stream-feed client open failed for ${task.id}: ${err.message}`);
              }
            }
          }
        },
        env: process.env,
        spawnImpl
      });

      if (feedClient) {
        try { await feedClient.close(); } catch (_) { /* best-effort */ }
      }
      return outcome;
    };

    let outcome = await attempt(0);
    liveChildren.delete(task.id);
    if (!outcome.result.ok && !interrupt.interrupted && config.retryOnFail) {
      state.patchTask(task.id, { retryCount: 1 });
      outcome = await attempt(1);
      liveChildren.delete(task.id);
    }

    const endedAt = nowIso();
    state.patchTask(task.id, {
      status: outcome.result.ok ? 'done' : 'failed',
      endedAt,
      exitCode: outcome.exitCode,
      durationMs: outcome.durationMs,
      missing: outcome.result.missing || []
    });
    writeEvent(config.projectDir, outcome.result.ok ? 'task_done' : 'task_failed', {
      task_id: task.id,
      wave: task.wave,
      domain: task.domain,
      exit_code: outcome.exitCode,
      duration_ms: outcome.durationMs
    });

    results.push({ task, outcome });
    if (!outcome.result.ok && config.haltOnSecondFail) {
      haltRequested = true;
    }
    return outcome;
  };

  const pump = async () => {
    while (queue.length && running.size < config.maxParallel && !haltRequested && !interrupt.interrupted) {
      const task = queue.shift();
      const p = launch(task).finally(() => running.delete(p));
      running.add(p);
    }
  };

  await pump();
  while (running.size) {
    await Promise.race(running);
    if (!haltRequested && !interrupt.interrupted) await pump();
  }

  return { results, halted: haltRequested, liveChildren };
}

function emitWaveBoundary(onFrame, state, wave, taskCount, extra) {
  if (typeof onFrame !== 'function') return;
  const frame = { type: 'wave-boundary', wave, state, taskCount, ts: nowIso() };
  if (extra) Object.assign(frame, extra);
  try { onFrame(frame); } catch (_) {}
}

async function runOrchestrator(opts) {
  const {
    projectDir,
    milestone,
    maxParallel,
    workerTimeoutMs,
    logger = console,
    spawnImpl,
    runWorkerImpl,
    onFrame,
    installSignalHandlers = true,
    streamFeed = null,  // D1-T7: null|false = off, true = default (env-aware), object = client opts
    streamFeedFactory: streamFeedFactoryOverride = null,  // test hook
    resume = false,
    noArchive = false
  } = opts;

  const config = loadConfig({
    projectDir,
    cliFlags: {
      ...(maxParallel != null ? { maxParallel } : {}),
      ...(workerTimeoutMs != null ? { workerTimeoutMs } : {})
    },
    env: process.env
  });
  config.milestone = milestone || 'unknown';

  const allTasks = readAllTasks(projectDir);
  const scopedTasks = filterTasksByMilestone(allTasks, milestone);
  if (!scopedTasks.length) {
    logger.log(`[orchestrator] no tasks found under ${projectDir}/.gsd-t/domains/*/tasks.md`);
    return { status: 'empty', waves: [] };
  }

  validateNoForwardDeps(scopedTasks);
  const waves = groupByWave(scopedTasks);

  const state = makeState(projectDir);

  // D6-T2: --resume handling. Ran before we touch state.save().
  //   fresh    → error (no run to resume)
  //   terminal → archive (unless --no-archive) and start fresh
  //   resume   → seed state.tasks from reconciled recovery output, skip done/ambiguous
  let resumedSkipIds = new Set(); // task ids to not re-launch (done + ambiguous)
  let resumeStartWave = null;
  if (resume) {
    const recovery = recoverRunState({ projectDir });
    for (const note of (recovery.notes || [])) logger.log(`[resume] ${note}`);
    if (recovery.mode === 'fresh') {
      const err = new Error('no run to resume — .gsd-t/orchestrator/state.json is missing');
      err.code = 'NO_RESUME_STATE';
      throw err;
    }
    if (recovery.mode === 'terminal') {
      if (noArchive) {
        const err = new Error('--resume requested but state is terminal and --no-archive was set');
        err.code = 'TERMINAL_NO_ARCHIVE';
        throw err;
      }
      const { archived, archivePath } = archiveState(projectDir);
      if (archived) logger.log(`[resume] archived terminal state → ${archivePath}; starting fresh`);
    } else if (recovery.mode === 'resume') {
      // Persist reconciled task statuses and load them into the in-memory state.
      writeRecoveredState(projectDir, { ...recovery.state, tasks: recovery.tasks });
      state.data = { ...recovery.state, tasks: recovery.tasks };
      for (const [tid, t] of Object.entries(recovery.tasks)) {
        if (t.status === 'done' || t.status === 'ambiguous') resumedSkipIds.add(tid);
        if (t.status === 'ambiguous') logger.log(`[resume] task ${tid} is AMBIGUOUS — commit without progress entry; skipped, needs operator triage`);
      }
      resumeStartWave = recovery.currentWave;
      if (resumeStartWave != null) {
        logger.log(`[resume] continuing from wave ${resumeStartWave} (${resumedSkipIds.size}/${Object.keys(recovery.tasks).length} tasks already done or ambiguous)`);
      } else {
        logger.log('[resume] all tasks reconciled as done/ambiguous — nothing left to run');
      }
    }
  }

  state.save({ milestone: config.milestone, totalTasks: scopedTasks.length, waves: [...waves.keys()] });
  writeEvent(projectDir, resume ? 'orchestrator_resume' : 'orchestrator_start', { milestone: config.milestone, total_tasks: scopedTasks.length });

  // D1-T7: stream-feed wiring. `streamFeed: true` means "open clients pointed at
  // the default local server". `streamFeed: { port, host }` overrides. `false`/null
  // disables. If a user-supplied onFrame is the consumer, they can still opt-in.
  let streamFeedFactory = streamFeedFactoryOverride;
  let orchestratorFeedClient = null;
  const feedOpts = (streamFeed && typeof streamFeed === 'object') ? streamFeed : {};
  const feedEnabled = streamFeed === true || (streamFeed && typeof streamFeed === 'object');
  if (feedEnabled && !streamFeedFactory) {
    streamFeedFactory = ({ workerPid, taskId, projectDir }) => createStreamFeedClient({
      ...feedOpts,
      projectDir,
      workerPid,
      taskId
    });
  }
  if (streamFeedFactory) {
    try {
      orchestratorFeedClient = streamFeedFactory({
        workerPid: process.pid,
        taskId: 'orchestrator',
        projectDir
      });
    } catch (err) {
      logger.log(`[orchestrator] stream-feed orchestrator client open failed: ${err.message}`);
    }
  }

  const teeWaveFrame = (frame) => {
    if (typeof onFrame === 'function') { try { onFrame(frame); } catch (_) {} }
    if (orchestratorFeedClient) {
      try { orchestratorFeedClient.pushFrame(frame); } catch (_) {}
    }
  };

  const interrupt = { interrupted: false, currentWaveChildren: null };

  let sigintHandler = null;
  if (installSignalHandlers && typeof process.on === 'function') {
    sigintHandler = () => {
      if (interrupt.interrupted) return;
      interrupt.interrupted = true;
      logger.log('[orchestrator] SIGINT received — terminating workers');
      writeEvent(projectDir, 'orchestrator_interrupt', {});
      if (interrupt.currentWaveChildren) {
        for (const child of interrupt.currentWaveChildren.values()) {
          try { child.kill('SIGTERM'); } catch (_) {}
        }
      }
    };
    process.on('SIGINT', sigintHandler);
  }

  const cleanup = () => {
    if (sigintHandler && typeof process.removeListener === 'function') {
      try { process.removeListener('SIGINT', sigintHandler); } catch (_) {}
    }
    if (orchestratorFeedClient) {
      try { orchestratorFeedClient.close(); } catch (_) {}
      orchestratorFeedClient = null;
    }
  };

  try {
    const waveResults = [];
    for (const [waveNum, waveTasks] of waves) {
      if (interrupt.interrupted) break;
      // D6-T2: on resume, skip waves entirely behind the resume point.
      if (resumeStartWave != null && waveNum < resumeStartWave) {
        writeEvent(projectDir, 'wave_skipped', { wave: waveNum, reason: 'resume_before' });
        continue;
      }
      // Filter out tasks that recovery marked done/ambiguous.
      const effectiveTasks = resumedSkipIds.size
        ? waveTasks.filter((t) => !resumedSkipIds.has(t.id))
        : waveTasks;
      if (effectiveTasks.length === 0) {
        writeEvent(projectDir, 'wave_skipped', { wave: waveNum, reason: 'all_tasks_reconciled' });
        continue;
      }

      state.save({ currentWave: waveNum, status: 'running' });
      writeEvent(projectDir, 'wave_start', { wave: waveNum, task_count: effectiveTasks.length });
      emitWaveBoundary(teeWaveFrame, 'start', waveNum, effectiveTasks.length);

      const waveStartedMs = Date.now();
      const waveLiveChildren = new Map();
      interrupt.currentWaveChildren = waveLiveChildren;
      const { results, halted } = await runWaveTasks({
        tasks: effectiveTasks,
        config,
        state,
        logger,
        spawnImpl,
        runWorkerImpl,
        onFrame,
        interrupt,
        liveChildrenRef: waveLiveChildren,
        streamFeedFactory
      });

      const failed = results.filter((r) => !r.outcome.result.ok);
      const waveDurationMs = Date.now() - waveStartedMs;
      waveResults.push({ wave: waveNum, total: waveTasks.length, done: results.length - failed.length, failed: failed.length });
      writeEvent(projectDir, failed.length ? 'wave_failed' : 'wave_done', {
        wave: waveNum,
        failed_count: failed.length
      });
      emitWaveBoundary(teeWaveFrame, failed.length ? 'failed' : 'done', waveNum, waveTasks.length, { durationMs: waveDurationMs, failed: failed.length });

      if (interrupt.interrupted) break;

      if (halted || failed.length) {
        state.save({ status: 'failed' });
        logger.log(`[wave_halt] wave=${waveNum} failed_tasks=${failed.length}`);
        writeEvent(projectDir, 'orchestrator_halt', { wave: waveNum, failed_count: failed.length });
        return { status: 'failed', waves: waveResults, failedWave: waveNum };
      }
    }

    if (interrupt.interrupted) {
      state.save({ status: 'interrupted', endedAt: nowIso() });
      writeEvent(projectDir, 'orchestrator_done_interrupted', {});
      return { status: 'interrupted', waves: waveResults };
    }

    state.save({ status: 'done', endedAt: nowIso() });
    writeEvent(projectDir, 'orchestrator_done', { waves: waveResults.length });
    return { status: 'done', waves: waveResults };
  } finally {
    cleanup();
  }
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }
  if (!args.milestone) {
    process.stderr.write('Error: --milestone is required\n\n');
    printHelp();
    process.exit(2);
  }
  let streamFeedOpt = args.streamFeed;
  if (streamFeedOpt) {
    if (args.streamFeedPort || args.streamFeedHost) {
      streamFeedOpt = {};
      if (args.streamFeedPort) streamFeedOpt.port = args.streamFeedPort;
      if (args.streamFeedHost) streamFeedOpt.host = args.streamFeedHost;
    }
  }
  try {
    const res = await runOrchestrator({
      projectDir: args.projectDir,
      milestone: args.milestone,
      maxParallel: args.maxParallel,
      workerTimeoutMs: args.workerTimeoutMs,
      streamFeed: streamFeedOpt,
      resume: args.resume,
      noArchive: args.noArchive
    });
    if (res.status === 'interrupted') {
      process.exit(130);
    }
    if (res.status === 'failed') {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    process.stderr.write(`[orchestrator] ${err.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runOrchestrator,
  runWaveTasks,
  parseCliArgs,
  atomicWriteJson
};
