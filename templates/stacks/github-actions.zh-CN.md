# GitHub Actions 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. 工作流结构

```
强制:
  ├── 每个关注点一个工作流: ci.yml, deploy.yml, release.yml
  ├── 清晰命名工作流: name: "CI — Lint, Test, Build"
  ├── 在特定事件上触发 — 绝不用不带分支过滤的 on: push
  ├── 对 deploy/release 工作流使用 workflow_dispatch 手动触发
  └── 保持工作流在 200 行内 — 将可复用的逻辑提取到 composite actions
```

**好**
```yaml
name: CI — Lint, Test, Build
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
```

---

## 2. 任务设计

```
强制:
  ├── 描述性命名任务: jobs: lint:, jobs: test-unit:, jobs: build:
  ├── 使用 needs: 进行任务依赖 — 并行化独立任务
  ├── 在每个任务上设置 timeout-minutes（默认 360 太长）
  ├── 对多版本/多平台测试使用 matrix 策略
  └── 默认快速失败 — 只在需要所有结果时设置 fail-fast: false
```

**好**
```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps: ...

  test:
    needs: lint
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      matrix:
        node-version: [18, 20]
    steps: ...

  build:
    needs: test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps: ...
```

---

## 3. 缓存

```
强制:
  ├── 缓存依赖（node_modules, pip, gradle）— 每次运行节省几分钟
  ├── 使用 actions/cache 或带 cache: 'npm' 的 setup-node
  ├── 缓存密钥必须包含锁文件哈希 — 依赖更改时失效
  ├── 单独缓存 Playwright 浏览器（它们很大）
  └── 为部分缓存命中设置 restore-keys
```

**好**
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'

# 或显式缓存:
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: ${{ runner.os }}-npm-
```

---

## 4. 密钥管理

```
强制:
  ├── 绝不在工作流文件中硬编码密钥、令牌或 API 密钥
  ├── 使用 GitHub 仓库或环境密钥
  ├── 对 deploy 工作流使用环境范围密钥（staging vs production）
  ├── 限制密钥访问: 只有需要的任务才应该引用它们
  ├── 绝不要回显或记录密钥 — 即使是通过调试输出意外
  └── 定期轮换密钥 — 设置提醒
```

**坏**
```yaml
env:
  API_KEY: sk-abc123  # 绝不要这样做
```

**好**
```yaml
env:
  API_KEY: ${{ secrets.API_KEY }}
```

---

## 5. Actions 版本控制

```
强制:
  ├── 将 actions 固定到主版本: uses: actions/checkout@v4
  ├── 对于安全关键的工作流，固定到 SHA: uses: actions/checkout@abc123
  ├── 对第三方 actions 绝不用 @latest 或 @main
  ├── 使用前审查第三方 actions — 检查源代码
  └── 优先使用官方 actions（actions/*, github/*）而非社区 ones
```

---

## 6. 部署工作流

```
强制:
  ├── 生产部署要求手动批准（环境保护规则）
  ├── 先部署到 staging — 只有 staging 通过后才到 production
  ├── 包含回滚步骤或记录回滚流程
  ├── 成功部署后用版本号标记发布
  ├── 使用并发组防止并行部署
  └── 部署后: 对部署的环境运行冒烟测试
```

**好**
```yaml
deploy-production:
  needs: deploy-staging
  runs-on: ubuntu-latest
  environment:
    name: production
    url: https://app.example.com
  concurrency:
    group: deploy-production
    cancel-in-progress: false
```

---

## 7. 通知和产物

```
推荐:
  ├── 上传测试结果和覆盖率作为产物
  ├── 失败时通知（Slack, email）— 不要在每次成功时通知
  ├── 为 deploy 任务上传构建产物以下载
  ├── 设置产物保留天数（默认 90 天通常太长）
  └── 使用 job summaries（echo >> $GITHUB_STEP_SUMMARY）展示关键指标
```

---

## 8. 反模式

```
绝不要:
  ├── 不带分支过滤的 on: push（在每个分支上触发）
  ├── 工作流文件中硬编码密钥
  ├── actions 使用 @latest 或 @main — 固定版本
  ├── 没有 timeout-minutes 的任务
  ├── 跳过缓存 — 每次运行浪费几分钟
  ├── 没有 staging 关卡就部署到生产
  ├── 单个单体工作流文件（500+ 行）
  └── 在来自 fork 的 PR 上运行昂贵的任务而不经批准
```

---

## GitHub Actions 验证清单

- [ ] 工作流有描述性名称和特定触发器
- [ ] push 触发器有分支过滤
- [ ] 任务设置了 timeout-minutes
- [ ] 缓存了依赖（npm, pip 等）
- [ ] 密钥在 GitHub Secrets 中 — 从不清硬编码
- [ ] Actions 固定到主版本或 SHA
- [ ] 部署要求 staging → production 流程
- [ ] 生产部署有环境保护
- [ ] 并发组防止并行部署
- [ ] 上传了测试产物
