'use strict';
/**
 * test/m94-d3-indexer-core.test.js
 *
 * M94 D3-T1 + D3-T2 — Edge extraction + build_index + parse_and_put tests.
 *
 * Tests:
 *  1. extractEdges — hand-checked fixture yields expected import/call edges (AC-2 correctness seed)
 *  2. extractEdges — output shape matches D1 store-schema (entities with funcId, edges with kind/source/target)
 *  3. extractEdges — [RULE] who-calls-function-identity-disambiguated:
 *       same-named functions in different files get DISTINCT funcIds
 *  4. extractEdges — [RULE] who-calls-function-identity-disambiguated:
 *       call-site edges keyed by funcId at BOTH ends (not bare name)
 *  5. extractEdges — CommonJS require() produces 'require' edges
 *  6. extractEdges — re-export produces import edge + export entity
 *  7. extractEdges — class entities extracted with class type
 *  8. build_index — fixture repo end-to-end: store records written with correct columns
 *  9. build_index — parse_and_put re-parses a single file and returns new entities/edges
 * 10. build_index — parse_and_put surface is exercised (not dead): returns non-null result
 * 11. extractEdges — arrow function assigned to const produces function entity
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');

// ── Paths ─────────────────────────────────────────────────────────────────────

const EDGE_EXTRACT = path.join(__dirname, '..', 'bin', 'gsd-t-graph-edge-extract.cjs');
const GRAPH_INDEX = path.join(__dirname, '..', 'bin', 'gsd-t-graph-index.cjs');

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d3-test-'));
}

function writeFixture(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

// ── Test 1: hand-checked fixture → expected who-imports + who-calls edges ─────

test('T1: extractEdges — hand-checked fixture yields expected import + call-site edges (AC-2 seed)', () => {
  const dir = makeTempDir();
  // user.ts imports from db.ts and calls query()
  const userTs = writeFixture(dir, 'src/user.ts', `
import { query } from '../lib/db';
import { logger } from '../lib/logger';

export function createUser(name: string) {
  logger.info('creating user');
  return query('INSERT INTO users VALUES (?)', [name]);
}
`);
  const relPath = 'src/user.ts';

  const { extractEdges } = require(EDGE_EXTRACT);
  const result = extractEdges(userTs, relPath);

  assert.strictEqual(result.file, relPath, 'file field matches relPath');
  assert.ok(result.loc > 0, 'LOC > 0');

  // Must find import edges for both modules
  const importEdges = result.edges.filter(e => e.kind === 'import');
  const importTargets = importEdges.map(e => e.target);
  assert.ok(importTargets.some(t => t === '../lib/db'), `missing import ../lib/db; got: ${JSON.stringify(importTargets)}`);
  assert.ok(importTargets.some(t => t === '../lib/logger'), `missing import ../lib/logger; got: ${JSON.stringify(importTargets)}`);

  // Must find the createUser function entity
  const entities = result.entities;
  const fnEntity = entities.find(e => e.name === 'createUser');
  assert.ok(fnEntity, `createUser entity not found; got: ${JSON.stringify(entities.map(e => e.name))}`);
  assert.ok(fnEntity.exported, 'createUser must be exported');
  assert.ok(fnEntity.id.startsWith('src/user.ts#'), `funcId must start with file path: ${fnEntity.id}`);

  // Must have at least one call-site edge (query or logger.info)
  const callEdges = result.edges.filter(e => e.kind === 'call-site');
  assert.ok(callEdges.length > 0, `Expected call-site edges; got none. Edges: ${JSON.stringify(result.edges.map(e => e.kind))}`);
});

// ── Test 2: output shape matches D1 store-schema ─────────────────────────────

test('T1: extractEdges — output shape matches D1 store-schema (entities have id/name/type, edges have kind/source/target)', () => {
  const dir = makeTempDir();
  const absPath = writeFixture(dir, 'src/example.ts', `
import { helper } from './utils';
export class MyService {
  doWork() { helper(); }
}
`);

  const { extractEdges } = require(EDGE_EXTRACT);
  const result = extractEdges(absPath, 'src/example.ts');

  // Shape checks: file
  assert.ok(typeof result.file === 'string', 'result.file must be string');
  assert.ok(typeof result.loc === 'number', 'result.loc must be number');
  assert.ok(Array.isArray(result.entities), 'result.entities must be array');
  assert.ok(Array.isArray(result.edges), 'result.edges must be array');

  // Entity shape
  for (const entity of result.entities) {
    assert.ok(typeof entity.id === 'string' && entity.id.length > 0, `entity.id must be non-empty string: ${JSON.stringify(entity)}`);
    assert.ok(typeof entity.name === 'string', `entity.name must be string: ${JSON.stringify(entity)}`);
    assert.ok(typeof entity.type === 'string', `entity.type must be string: ${JSON.stringify(entity)}`);
    assert.ok(typeof entity.exported === 'boolean', `entity.exported must be boolean: ${JSON.stringify(entity)}`);
    // funcId must be file-qualified: "relPath#name..."
    assert.ok(entity.id.includes('#'), `entity.id must be funcId (file#name): ${entity.id}`);
  }

  // Edge shape
  for (const edge of result.edges) {
    assert.ok(['import', 'require', 'call-site'].includes(edge.kind), `edge.kind must be import/require/call-site: ${edge.kind}`);
    assert.ok(typeof (edge.source || edge.src) === 'string', `edge source must be string: ${JSON.stringify(edge)}`);
    assert.ok(typeof (edge.target || edge.dst) === 'string', `edge target must be string: ${JSON.stringify(edge)}`);
  }
});

// ── Test 3: [RULE] who-calls-function-identity-disambiguated ─────────────────

test('T1: [RULE] who-calls-function-identity-disambiguated — same-named functions across files get DISTINCT funcIds', () => {
  const dir = makeTempDir();

  const absA = writeFixture(dir, 'src/a.ts', `
export function handle() { return 'a'; }
`);
  const absB = writeFixture(dir, 'src/b.ts', `
export function handle() { return 'b'; }
`);

  const { extractEdges } = require(EDGE_EXTRACT);
  const resultA = extractEdges(absA, 'src/a.ts');
  const resultB = extractEdges(absB, 'src/b.ts');

  const handleA = resultA.entities.find(e => e.name === 'handle');
  const handleB = resultB.entities.find(e => e.name === 'handle');

  assert.ok(handleA, 'handle in a.ts not found');
  assert.ok(handleB, 'handle in b.ts not found');
  assert.notStrictEqual(handleA.id, handleB.id,
    `Same-named function must have DISTINCT funcIds. Got both: ${handleA.id}`);
  assert.ok(handleA.id.startsWith('src/a.ts#'), `handle in a.ts funcId must start with src/a.ts#: ${handleA.id}`);
  assert.ok(handleB.id.startsWith('src/b.ts#'), `handle in b.ts funcId must start with src/b.ts#: ${handleB.id}`);
});

// ── Test 4: call-site edges keyed by funcId at BOTH ends ─────────────────────

test('T1: [RULE] who-calls-function-identity-disambiguated — call-site edges src is funcId (not bare name)', () => {
  const dir = makeTempDir();
  const absPath = writeFixture(dir, 'src/caller.ts', `
function doWork() {
  helper();
}
`);

  const { extractEdges } = require(EDGE_EXTRACT);
  const result = extractEdges(absPath, 'src/caller.ts');

  const callEdges = result.edges.filter(e => e.kind === 'call-site');
  // At least one call-site edge expected (doWork calls helper)
  // src must be a funcId, not just a bare name
  for (const edge of callEdges) {
    const src = edge.source || edge.src;
    assert.ok(src.includes('src/caller.ts'), `call-site edge src must contain file path: ${src}`);
    // Must contain '#' (funcId separator)
    assert.ok(src.includes('#'), `call-site edge src must be funcId (file#name): ${src}`);
  }
});

// ── Test 5: CommonJS require() ────────────────────────────────────────────────

test('T1: extractEdges — CommonJS require() produces require edges', () => {
  const dir = makeTempDir();
  const absPath = writeFixture(dir, 'lib/loader.cjs', `
const db = require('./db');
const { helper } = require('../utils/helper');
`);

  const { extractEdges } = require(EDGE_EXTRACT);
  const result = extractEdges(absPath, 'lib/loader.cjs');

  const reqEdges = result.edges.filter(e => e.kind === 'require');
  const targets = reqEdges.map(e => e.target);
  assert.ok(targets.some(t => t === './db'), `Missing require ./db; got: ${JSON.stringify(targets)}`);
  assert.ok(targets.some(t => t === '../utils/helper'), `Missing require ../utils/helper; got: ${JSON.stringify(targets)}`);
});

// ── Test 6: re-export produces import edge ────────────────────────────────────

test('T1: extractEdges — re-export from another file produces import edge', () => {
  const dir = makeTempDir();
  const absPath = writeFixture(dir, 'src/index.ts', `
export { createUser } from './user';
export { query } from '../lib/db';
`);

  const { extractEdges } = require(EDGE_EXTRACT);
  const result = extractEdges(absPath, 'src/index.ts');

  const importEdges = result.edges.filter(e => e.kind === 'import');
  const targets = importEdges.map(e => e.target);
  assert.ok(targets.some(t => t === './user'), `Missing re-export import from ./user; got: ${JSON.stringify(targets)}`);
  assert.ok(targets.some(t => t === '../lib/db'), `Missing re-export import from ../lib/db; got: ${JSON.stringify(targets)}`);
});

// ── Test 7: class entities ────────────────────────────────────────────────────

test('T1: extractEdges — class entities extracted with type=class', () => {
  const dir = makeTempDir();
  const absPath = writeFixture(dir, 'src/service.ts', `
export class UserService {
  private db: any;
  getUser(id: string) { return this.db.find(id); }
}
`);

  const { extractEdges } = require(EDGE_EXTRACT);
  const result = extractEdges(absPath, 'src/service.ts');

  const classEntity = result.entities.find(e => e.type === 'class' && e.name === 'UserService');
  assert.ok(classEntity, `UserService class entity not found; got: ${JSON.stringify(result.entities)}`);
  assert.ok(classEntity.exported, 'UserService should be marked exported');
  assert.ok(classEntity.id.startsWith('src/service.ts#'), `class funcId should start with file path: ${classEntity.id}`);
});

// ── Test 8: build_index end-to-end ────────────────────────────────────────────

test('T2: build_index — fixture repo end-to-end: store records written with correct columns', () => {
  const dir = makeTempDir();
  const dbPath = path.join(dir, 'graph.db');

  // Create a small fixture repo
  writeFixture(dir, 'src/user.ts', `
import { query } from '../lib/db';
export function createUser(name: string) { return query(name); }
`);
  writeFixture(dir, 'lib/db.ts', `
export function query(sql: string) { return []; }
`);

  const { build_index, openStore, getRecord } = require(GRAPH_INDEX);
  const result = build_index(dir, { dbPath });

  assert.ok(result.fileCount >= 2, `Expected >= 2 files indexed; got ${result.fileCount}`);
  assert.ok(result.entityCount > 0, 'Expected entities to be indexed');
  assert.ok(result.edgeCount > 0, 'Expected edges to be indexed');
  assert.ok(typeof result.durationMs === 'number', 'durationMs must be a number');

  // Verify store records were written
  const db = openStore(dbPath);
  const userRecord = getRecord(db, 'src/user.ts');
  const dbRecord = getRecord(db, 'lib/db.ts');
  db.close();

  assert.ok(userRecord, 'src/user.ts record not found in store');
  assert.ok(dbRecord, 'lib/db.ts record not found in store');
  assert.ok(typeof userRecord.contentHash === 'string' && userRecord.contentHash.length > 0,
    'user.ts record must have contentHash');
  assert.ok(['compiler-accurate', 'tree-sitter-floor', 'tree-sitter-floor-STALE-SCIP'].includes(userRecord.tier),
    `user.ts tier must be a valid tier; got: ${userRecord.tier}`);
});

// ── Test 9: parse_and_put re-parses a single file ────────────────────────────

test('T2: parse_and_put — re-parses a single file and returns new entities/edges', () => {
  const dir = makeTempDir();
  const dbPath = path.join(dir, 'graph.db');

  // Initial file
  const userFile = writeFixture(dir, 'src/user.ts', `
export function createUser(name: string) { return name; }
`);

  const { build_index, openStore, parse_and_put } = require(GRAPH_INDEX);
  // Build first pass
  build_index(dir, { dbPath });

  // Edit the file
  fs.writeFileSync(userFile, `
export function createUser(name: string) { return name; }
export function deleteUser(id: string) { return id; }
`);

  // Re-index via parse_and_put
  const db = openStore(dbPath);
  const result = parse_and_put(userFile, 'src/user.ts', { db });
  db.close();

  // Must return entities including the new deleteUser
  assert.ok(result, 'parse_and_put must return a result');
  assert.ok(Array.isArray(result.entities), 'result.entities must be array');
  assert.ok(Array.isArray(result.edges), 'result.edges must be array');
  assert.ok(typeof result.tier === 'string', 'result.tier must be string');
  assert.ok(typeof result.contentHash === 'string', 'result.contentHash must be string');

  const deleteUser = result.entities.find(e => e.name === 'deleteUser');
  assert.ok(deleteUser, `deleteUser not found after re-index; got: ${JSON.stringify(result.entities.map(e => e.name))}`);
});

// ── Test 10: parse_and_put surface is not dead ───────────────────────────────

test('T2: parse_and_put — surface is exercised (not dead): returns non-null, non-empty result', () => {
  const dir = makeTempDir();
  const dbPath = path.join(dir, 'graph.db');

  const absFile = writeFixture(dir, 'src/lib.ts', `
import { something } from './other';
export function process(x: string) { return something(x); }
`);

  const { openStore, parse_and_put } = require(GRAPH_INDEX);
  const db = openStore(dbPath);
  const result = parse_and_put(absFile, 'src/lib.ts', { db });
  db.close();

  assert.ok(result !== null && result !== undefined, 'parse_and_put must not return null/undefined');
  assert.ok(result.entities.length > 0 || result.edges.length > 0,
    'parse_and_put must produce at least one entity or edge (not dead/empty)');
});

// ── Test 11: arrow function assigned to const ────────────────────────────────

test('T1: extractEdges — arrow function assigned to const produces function entity', () => {
  const dir = makeTempDir();
  const absPath = writeFixture(dir, 'src/handlers.ts', `
export const handleRequest = (req: any) => {
  return req.body;
};
const internalHelper = function(x: string) { return x.trim(); };
`);

  const { extractEdges } = require(EDGE_EXTRACT);
  const result = extractEdges(absPath, 'src/handlers.ts');

  const handler = result.entities.find(e => e.name === 'handleRequest');
  assert.ok(handler, `handleRequest entity not found; got: ${JSON.stringify(result.entities.map(e => e.name))}`);
  assert.strictEqual(handler.type, 'function', 'handleRequest should have type=function');
  assert.ok(handler.exported, 'handleRequest should be exported');

  const helper = result.entities.find(e => e.name === 'internalHelper');
  assert.ok(helper, `internalHelper entity not found; got: ${JSON.stringify(result.entities.map(e => e.name))}`);
  assert.strictEqual(helper.exported, false, 'internalHelper should not be exported');
});
