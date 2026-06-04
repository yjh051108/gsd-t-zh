'use strict';

function genSystemArchitecture(analysisData) {
  try {
    // M79: when real feature domains were extracted from docs/architecture.md, draw
    // them as the system's services (User -> Backend -> each domain). Show up to 12.
    const services = (analysisData.services || []).slice(0, 12);
    if (services.length >= 2) {
      const lines = ['graph TB',
        '  User(["&#128100; User"]):::user',
        '  API["&#9889; Backend / API"]:::core',
        '  User -->|"HTTPS"| API'];
      services.forEach((s, i) => {
        const label = String(s).replace(/"/g, "'");
        lines.push('  S' + i + '["' + label + '"]:::svc');
        lines.push('  API --> S' + i);
      });
      lines.push('  classDef user fill:#0d2035,stroke:#22d3ee,color:#a5f3fc,rx:8,ry:8');
      lines.push('  classDef core fill:#1a0f3a,stroke:#a78bfa,color:#ede9fe,rx:8,ry:8');
      lines.push('  classDef svc fill:#0f1d3a,stroke:#60a5fa,color:#bfdbfe,rx:8,ry:8');
      return lines.join('\n');
    }
    return `graph TB
  classDef user fill:#0d2035,stroke:#06b6d4,color:#a5f3fc
  classDef app  fill:#0f1d3a,stroke:#3b82f6,color:#bfdbfe
  classDef api  fill:#1a0f3a,stroke:#7c3aed,color:#ddd6fe
  classDef db   fill:#0a2318,stroke:#10b981,color:#a7f3d0
  classDef ext  fill:#111827,stroke:#374151,color:#9ca3af
  USER(["&#128100; User\\nweb &amp; mobile"]):::user
  subgraph PLATFORM["  Application Platform  "]
    APP["&#127760; Frontend\\nUser Interface"]:::app
    API["&#9889; Backend\\nApplication Logic"]:::api
    DB[("&#128451; Database\\nPrimary Store")]:::db
  end
  EXT["&#127758; External Services\\nAPIs &amp; Integrations"]:::ext
  USER -->|"HTTPS"| APP
  APP  -->|"REST / JSON"| API
  API  -->|"reads / writes"| DB
  API  -->|"calls"| EXT
  style PLATFORM fill:#0a0f1e,stroke:#1e3a5f,color:#e2e8f0`;
  } catch { return 'graph TB\n  App[Application] --> DB[(Database)]'; }
}

function genAppArchitecture(analysisData) {
  try {
    const layers = (analysisData.layers || []).slice(0, 5);
    if (layers.length >= 3) {
      const lines = ['graph TB'];
      const colors = ['#0f1d3a,#3b82f6', '#1a0f3a,#7c3aed', '#0a2318,#10b981', '#1f1505,#f59e0b', '#12102a,#6366f1'];
      layers.forEach((l, i) => {
        const [bg, stroke] = colors[i % colors.length].split(',');
        lines.push(`  L${i}["${l}"]`);
        lines.push(`  style L${i} fill:${bg},stroke:${stroke},color:#e2e8f0`);
        if (i > 0) lines.push(`  L${i - 1} --> L${i}`);
      });
      return lines.join('\n');
    }
    return `graph TB
  classDef client fill:#0d2035,stroke:#06b6d4,color:#a5f3fc
  classDef ctrl  fill:#0f1d3a,stroke:#3b82f6,color:#bfdbfe
  classDef svc   fill:#1a0f3a,stroke:#7c3aed,color:#ddd6fe
  classDef repo  fill:#1a0f3a,stroke:#8b5cf6,color:#ddd6fe
  classDef db    fill:#0a2318,stroke:#10b981,color:#a7f3d0
  subgraph CL["  Clients  "]
    WEB["&#127760; Web App"]:::client
    MOB["&#128241; Mobile"]:::client
  end
  subgraph CTR["  Controller Layer  "]
    AC["AuthController"]:::ctrl
    TC["TasksController"]:::ctrl
    PC["ProjectsController"]:::ctrl
  end
  subgraph SVC["  Service Layer  "]
    AS["AuthService"]:::svc
    TS["TasksService"]:::svc
    PS["ProjectsService"]:::svc
  end
  DB[("&#128451; Database")]:::db
  WEB & MOB --> CTR --> SVC --> DB
  style CL  fill:#080e1a,stroke:#0e2035
  style CTR fill:#080e1a,stroke:#1e3a5f
  style SVC fill:#080e1a,stroke:#2d1a5e`;
  } catch { return 'graph TB\n  subgraph App\n    Controllers --> Services --> Repositories\n  end'; }
}

function genWorkflow(analysisData) {
  try {
    const states = (analysisData.states || []).slice(0, 6);
    if (states.length >= 3) {
      const lines = ['stateDiagram-v2', '  direction LR', '  [*] --> ' + states[0]];
      states.forEach((s, i) => { if (i < states.length - 1) lines.push(`  ${s} --> ${states[i + 1]}`); });
      lines.push('  ' + states[states.length - 1] + ' --> [*]');
      return lines.join('\n');
    }
    return `stateDiagram-v2
  direction LR
  [*] --> Draft : create
  Draft --> Open        : submit
  Draft --> [*]         : discard
  Open --> InProgress   : assign
  Open --> Cancelled    : cancel
  InProgress --> Review : mark done
  InProgress --> Blocked : flag blocker
  InProgress --> Open   : unassign
  Blocked --> InProgress : resolve
  Review --> Done       : approve
  Review --> InProgress : reject
  Done --> [*]
  Cancelled --> [*]
  note right of Blocked
    No SLA timeout —
    can stagnate here
  end note`;
  } catch { return 'stateDiagram-v2\n  [*] --> Active\n  Active --> Done\n  Done --> [*]'; }
}

function genDataFlow(analysisData) {
  try {
    const endpoints = (analysisData.endpoints || []).slice(0, 1);
    const ep = endpoints[0] || 'POST /api/resource';
    return `flowchart TD
  classDef user   fill:#0d2035,stroke:#06b6d4,color:#a5f3fc
  classDef fe     fill:#0f1d3a,stroke:#3b82f6,color:#bfdbfe
  classDef api    fill:#1a0f3a,stroke:#7c3aed,color:#ddd6fe
  classDef db     fill:#0a2318,stroke:#10b981,color:#a7f3d0
  classDef queue  fill:#1f1505,stroke:#f59e0b,color:#fde68a
  classDef ok     fill:#0a2318,stroke:#10b981,color:#a7f3d0
  USR(["&#128100; User"]):::user
  subgraph FE["Frontend"]
    FORM["Form\\n+ Client Validation"]:::fe
  end
  subgraph API["API Server"]
    PIPE["ValidationPipe\\n+ Sanitize"]:::api
    CTRL["Controller\\n${ep}"]:::api
    SVC["Service\\nbusiness logic"]:::api
    REPO["Repository\\nINSERT / UPDATE"]:::api
  end
  DB[("&#128451; Database")]:::db
  RD[("&#9889; Queue")]:::queue
  RES(["&#10003; Response"]):::ok
  USR --> FORM --> PIPE --> CTRL --> SVC --> REPO --> DB
  SVC --> RD
  DB --> RES
  style FE  fill:#080e1a,stroke:#1e3a5f
  style API fill:#080e1a,stroke:#2d1a5e`;
  } catch { return 'flowchart TD\n  Input --> Validate --> Process --> Store --> Respond'; }
}

function genSequence(analysisData) {
  try {
    const ep = ((analysisData.endpoints || [])[0]) || 'POST /api/resource';
    return `sequenceDiagram
  autonumber
  actor User
  participant Client
  participant API as API Server
  participant DB as Database
  participant Queue
  User->>Client: Submit form
  Client->>API: ${ep}
  API->>API: validate and sanitize
  alt invalid input
    API-->>Client: 400 Bad Request
  else valid
    API->>DB: INSERT record
    DB-->>API: record id
    API->>Queue: enqueue background job
    API-->>Client: 201 Created
    Client-->>User: Success feedback
  end`;
  } catch { return 'sequenceDiagram\n  Client->>Server: Request\n  Server->>DB: Query\n  DB-->>Server: Result\n  Server-->>Client: Response'; }
}

function genDatabaseSchema(schemaData) {
  try {
    if (!schemaData || !schemaData.detected || !schemaData.entities || schemaData.entities.length === 0) return '';
    const relMap = { 'one-to-many': '||--o{', 'many-to-one': '}o--||', 'many-to-many': '}o--o{', 'one-to-one': '||--||' };
    const lines = ['erDiagram'];
    for (const entity of schemaData.entities.slice(0, 8)) {
      lines.push('  ' + entity.name + ' {');
      for (const f of (entity.fields || []).slice(0, 10)) {
        lines.push('    ' + (f.type || 'string') + ' ' + f.name);
      }
      lines.push('  }');
    }
    for (const entity of schemaData.entities) {
      for (const rel of (entity.relations || [])) {
        lines.push('  ' + rel.fromEntity + ' ' + (relMap[rel.type] || '||--o{') + ' ' + rel.toEntity + ' : "has"');
      }
    }
    return lines.join('\n');
  } catch { return ''; }
}

module.exports = { genSystemArchitecture, genAppArchitecture, genWorkflow, genDataFlow, genSequence, genDatabaseSchema };
