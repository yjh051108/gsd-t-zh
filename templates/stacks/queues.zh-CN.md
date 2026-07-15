# 队列 / 后台任务标准（检测到队列库时适用）

这些规则是 **强制** 的。违规导致任务失败。没有例外。
适用于 `package.json` 或依赖中包含 `bullmq`、`bull`、`amqplib`、`@aws-sdk/client-sqs`、`bee-queue`、`agenda`、`celery`、`dramatiq`、`rq`、`arq` 的项目。

---

## 1. 任务定义

```
强制:
  ├── 每个任务有唯一、描述性的名称: "email.welcome", "order.process", "report.generate"
  ├── 任务 payload 是纯可序列化对象 — 无类实例、函数或循环引用
  ├── 为每个任务的 payload 定义 schema（Zod/Pydantic）— 入队和处理时都验证
  ├── payload 包含元数据: correlationId, userId, enqueuedAt
  ├── 任务必须版本化: 包含 version 字段，以便处理器处理新旧格式
  ├── payload 保持小巧 — 大数据存在外部（S3, DB），传引用
  └── 绝不把 secrets、tokens 或完整用户记录放进任务 payload
```

**好**
```typescript
import { z } from "zod";

const WelcomeEmailJobSchema = z.object({
  version: z.literal(1),
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  correlationId: z.string().uuid(),
  enqueuedAt: z.string().datetime(),
});

type WelcomeEmailJob = z.infer<typeof WelcomeEmailJobSchema>;
```

**坏** — 无类型、膨胀的 payload:
```typescript
await queue.add("email", {
  user: entireUserObject,  // 太大，包含密码哈希
  template: fs.readFileSync("..."),  // 无法正确序列化
});
```

---

## 2. 幂等性

```
强制:
  ├── 每个任务处理器必须幂等 — 安全运行 2 次、10 次、100 次
  ├── 使用去重 key: 检查这个确切的任务是否已被处理
  ├── 数据库写入: 使用 upsert 或带唯一约束的 check-before-insert
  ├── 外部 API 调用: 使用幂等 key（Stripe, 支付提供商）
  ├── 邮件/通知: 记录 "已发送" 状态，已发送则跳过
  ├── 存储任务完成记录: { jobId, completedAt, result }
  └── 绝不假设任务只运行一次 — 重试、崩溃和重复都会发生
```

**好**
```typescript
async function processWelcomeEmail(job: Job<WelcomeEmailJob>): Promise<void> {
  // 幂等检查
  const existing = await db.jobResult.findUnique({
    where: { jobId: job.id },
  });
  if (existing) {
    logger.info(`Job ${job.id} already processed, skipping`);
    return;
  }

  await emailService.send({
    to: job.data.email,
    template: "welcome",
    data: { name: job.data.name },
  });

  // 记录完成
  await db.jobResult.create({
    data: { jobId: job.id, completedAt: new Date(), status: "SUCCESS" },
  });
}
```

---

## 3. 重试与退避

```
强制:
  ├── 配置指数退避重试 — 不是固定间隔
  ├── 设置最大重试次数（大多数任务 3-5 次，非关键任务可更高）
  ├── 退避公式: delay = baseDelay * 2^attempt + jitter
  ├── 区分可重试和不可重试错误:
  │     ├── 可重试: 网络超时, 429, 503, DB 连接丢失
  │     └── 不可重试: 验证错误, 404, 业务规则违反
  ├── 不可重试错误: 立即失败，不浪费重试次数
  ├── 记录每次重试: 尝试次数、错误、下次重试时间
  └── 绝不无限重试 — 始终有最大尝试次数上限
```

**好**
```typescript
// BullMQ 配置
const queue = new Queue("emails", {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000,  // 2s, 4s, 8s, 16s, 32s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

// 处理器中 — 不可重试错误跳过剩余重试
async function processJob(job: Job): Promise<void> {
  try {
    await doWork(job.data);
  } catch (error) {
    if (error instanceof ValidationError || error.status === 404) {
      // 不可重试 — 抛 UnrecoverableError 跳过剩余重试
      throw new UnrecoverableError(error.message);
    }
    throw error;  // 可重试 — BullMQ 会按退避重试
  }
}
```

---

## 4. 死信队列（DLQ）

```
强制:
  ├── 失败的任务（耗尽所有重试）进入死信队列 — 不是丢弃
  ├── DLQ 保留: 原始 payload、所有错误信息、重试历史
  ├── 监控 DLQ 大小 — 项目累积时告警（阈值: 10+）
  ├── 修复根因后构建检查并重放 DLQ 项目的流程
  ├── DLQ 项目有 TTL — 30 天后自动删除防止无界增长
  └── 绝不静默丢弃失败的任务 — 它们表示 bug 或基础设施问题
```

**好**
```typescript
// BullMQ — 最终失败的任务保留在 failed 集合中
// 创建监控失败的 DLQ worker
const dlqWorker = new Worker("emails", async (job) => {
  // 处理主队列。最终失败时:
}, {
  settings: {
    backoffStrategy: (attemptsMade) => Math.pow(2, attemptsMade) * 2000,
  },
});

dlqWorker.on("failed", async (job, error) => {
  if (job && job.attemptsMade >= job.opts.attempts!) {
    logger.error("Job moved to DLQ", {
      jobId: job.id,
      queue: job.queueName,
      payload: job.data,
      error: error.message,
      attempts: job.attemptsMade,
    });
    await alerting.notify("dlq-alert", `Job ${job.id} failed permanently`);
  }
});
```

---

## 5. 并发与速率限制

```
强制:
  ├── 每个 worker 设置并发数: 同时处理多少任务
  ├── 并发匹配资源容量（DB 连接、API 速率限制、内存）
  ├── 外部 API 调用使用速率限制: 如最多 10 封邮件/秒
  ├── 不同优先级级别使用独立队列: critical, default, low
  ├── 繁重任务（报表生成、文件处理）设置较低并发
  ├── 轻量任务（通知、日志）可以有较高并发
  └── 绝不设置无限并发 — 会压垮下游服务
```

**好**
```typescript
// 不同 worker 设置合适的并发
const emailWorker = new Worker("emails", processEmail, {
  concurrency: 5,           // 5 封邮件并发发送
  limiter: { max: 10, duration: 1000 },  // 最多 10/秒（提供商速率限制）
});

const reportWorker = new Worker("reports", processReport, {
  concurrency: 2,           // 繁重 — 限制 2 并发
});

const notificationWorker = new Worker("notifications", processNotification, {
  concurrency: 20,          // 轻量 — 高并发可接受
});
```

---

## 6. 优雅关闭

```
强制:
  ├── SIGTERM/SIGINT 时: 停止接受新任务，完成进行中的任务
  ├── 设置关闭超时（30s）— 任务未完成则强制终止
  ├── worker 排空后关闭队列连接
  ├── 记录关闭进度: "Waiting for N jobs to complete..."
  ├── Kubernetes/Docker: 处理 SIGTERM（容器停止信号）
  └── 绝不强制终止 worker — 进行中的任务会卡住/丢失
```

**好**
```typescript
const SHUTDOWN_TIMEOUT = 30_000;

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  const shutdownTimer = setTimeout(() => {
    logger.error("Shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // 停止接受新任务，等待进行中的完成
    await Promise.all([
      emailWorker.close(),
      reportWorker.close(),
      notificationWorker.close(),
    ]);
    await queue.close();
    logger.info("All workers shut down cleanly");
  } finally {
    clearTimeout(shutdownTimer);
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
```

---

## 7. 任务调度与延迟

```
强制:
  ├── 延迟任务使用 delay: "24 小时后发送提醒"
  ├── 循环任务使用 repeat/cron: "每周一 9 点生成报表"
  ├── Cron 任务必须幂等 — 重启时调度器可能触发两次
  ├── 调度定义存在配置中 — 不硬编码在代码中
  ├── 循环任务: 使用 jobId 防止重复（相同 ID = 相同任务）
  └── 不使用 setTimeout/setInterval 做计划任务 — 用队列的调度器
```

**好**
```typescript
// 延迟任务 — 24 小时后
await queue.add("reminder.24h", { userId, orderId }, {
  delay: 24 * 60 * 60 * 1000,  // 24 小时（毫秒）
});

// 循环任务 — 每天 UTC 9 点
await queue.add("report.daily", {}, {
  repeat: { pattern: "0 9 * * *" },  // Cron 语法
  jobId: "daily-report",              // 重启时防止重复
});
```

---

## 8. 监控与可观测性

```
强制:
  ├── 每个队列追踪: 活跃任务、等待任务、完成计数、失败计数
  ├── 每个任务追踪: 处理时长、使用的尝试次数、等待时间（入队 → 启动）
  ├── 告警: DLQ 增长、队列深度超阈值、处理时间突增
  ├── 仪表板: 展示上述所有指标的队列健康视图
  ├── 所有任务日志包含 correlationId 以便端到端追踪
  ├── 记录任务生命周期: enqueued → active → completed/failed 及耗时
  └── 绝不无监控运行队列 — 静默失败会累积
```

**好**
```typescript
// 生命周期日志
worker.on("active", (job) => {
  logger.info("Job started", {
    jobId: job.id,
    queue: job.queueName,
    correlationId: job.data.correlationId,
    waitTimeMs: Date.now() - job.timestamp,
  });
});

worker.on("completed", (job, result) => {
  logger.info("Job completed", {
    jobId: job.id,
    queue: job.queueName,
    correlationId: job.data.correlationId,
    durationMs: Date.now() - job.processedOn!,
    attempts: job.attemptsMade,
  });
});

worker.on("failed", (job, error) => {
  logger.error("Job failed", {
    jobId: job?.id,
    queue: job?.queueName,
    correlationId: job?.data.correlationId,
    error: error.message,
    attempt: job?.attemptsMade,
    maxAttempts: job?.opts.attempts,
  });
});
```

---

## 9. 队列架构

```
强制:
  ├── 每个任务域一个队列: "emails", "orders", "reports" — 不要一个 mega-队列
  ├── 生产者（入队）和消费者（处理）是分离的关注点
  ├── 生产者代码在服务层 — 不在路由处理器中
  ├── 消费者/worker 代码在独立目录: workers/ 或 jobs/
  ├── 队列配置（连接、重试、并发）在集中配置文件中
  ├── 使用共享连接（Redis/AMQP）跨队列 — 不为每个队列创建连接
  └── 不在 Web 服务器进程中处理任务 — 使用独立的 worker 进程
```

**好** — 项目结构:
```
src/
├── queues/
│   ├── connection.ts      ← 共享 Redis/AMQP 连接
│   ├── email.queue.ts     ← 队列定义 + add() 辅助函数
│   ├── order.queue.ts
│   └── report.queue.ts
├── workers/
│   ├── email.worker.ts    ← email 队列的任务处理器
│   ├── order.worker.ts
│   └── report.worker.ts
├── services/
│   └── order.service.ts   ← 通过队列辅助函数入队任务
└── worker.ts              ← 入口: 启动所有 workers（独立于 app.ts）
```

---

## 10. 测试

```
强制:
  ├── 任务处理器作为纯函数测试 — 传 payload，断言副作用
  ├── 在服务测试中 mock 队列 — 验证任务以正确的 payload 入队
  ├── 集成测试: 使用真实队列（本地 Redis）带测试专用前缀
  ├── 测试重试行为: 抛可重试错误，验证重试次数
  ├── 测试幂等性: 处理同一任务两次，验证无重复副作用
  ├── 测试 DLQ: 耗尽重试，验证任务落在 failed 状态
  └── 不依赖时间编写测试 — 用队列事件，不用 setTimeout
```

**好**
```typescript
describe("processWelcomeEmail", () => {
  it("sends email and records completion", async () => {
    const emailSpy = vi.spyOn(emailService, "send");
    const job = createMockJob({ email: "test@example.com", name: "Test" });

    await processWelcomeEmail(job);

    expect(emailSpy).toHaveBeenCalledWith({
      to: "test@example.com",
      template: "welcome",
      data: { name: "Test" },
    });
    const record = await db.jobResult.findUnique({ where: { jobId: job.id } });
    expect(record).toBeTruthy();
    expect(record!.status).toBe("SUCCESS");
  });

  it("is idempotent — skips if already processed", async () => {
    const job = createMockJob({ email: "test@example.com", name: "Test" });
    await processWelcomeEmail(job);  // 第一次运行

    const emailSpy = vi.spyOn(emailService, "send").mockClear();
    await processWelcomeEmail(job);  // 第二次运行 — 应该跳过

    expect(emailSpy).not.toHaveBeenCalled();
  });
});
```

---

## 反模式

```
绝不要:
  ├── 在 Web 服务器进程中处理任务 — 使用独立的 worker 进程
  ├── 所有任务类型用一个 mega-队列 — 按域分开
  ├── 假设恰好一次投递 — 始终按至多一次设计（幂等处理器）
  ├── 大 payload 放进任务 — 存外部，传引用
  ├── 不可重试错误重试（验证, 404）— 立即失败
  ├── 无限并发 — 会压垮下游服务
  ├── setTimeout/setInterval 做计划任务 — 用队列调度器
  ├── 无优雅关闭就终止 worker — 任务会卡住
  ├── 静默 DLQ — 监控并告警死信增长
  ├── 依赖时间的测试 — 用队列事件做断言
  └── Secrets 或 tokens 在任务 payload 中 — 它们持久化在队列存储中
```

---

## 队列验证清单

- [ ] 一个域一个队列，共享连接
- [ ] 任务 payload schema 验证、小巧、可序列化
- [ ] 每个处理器幂等，有去重检查
- [ ] 指数退避重试，不可重试错误快速失败
- [ ] 配置了死信队列，带监控和告警
- [ ] 每个 worker 的并发基于下游容量设置
- [ ] 外部 API 调用有速率限制
- [ ] 优雅关闭处理 SIGTERM 带超时
- [ ] 循环任务用 cron 带重复预防（jobId）
- [ ] Workers 在独立进程中运行，不在 Web 服务器中
- [ ] 任务生命周期日志带 correlationId 追踪
- [ ] 测试验证幂等性、重试行为和 DLQ
