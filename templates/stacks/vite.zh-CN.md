# Vite 规范

这些规则是**强制性的**。违反即任务失败。无例外。

---

## 1. 环境变量

```
强制:
  ├── 所有客户端暴露的环境变量前缀加 VITE_ — Vite 会 stripping 其他前缀
  ├── 通过 import.meta.env.VITE_* 访问 — 绝不用 process.env (那是 Node, 不是 Vite)
  ├── 提交 .env.development 和 .env.production — 两者都不能有 secrets
  ├── 把 .env.local 加入 .gitignore — 仅开发者本地覆盖
  └── 绝不在 VITE_ 变量中放 API key 或 secrets — 会被打包进客户端代码
```

**禁止**
```typescript
const url = process.env.API_URL;           // 浏览器中 undefined
const key = import.meta.env.VITE_API_KEY;  // secret 暴露给客户端!
```

**正确**
```typescript
// .env.development
// VITE_API_BASE_URL=http://localhost:4000/api

// src/lib/constants.ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
```

---

## 2. 配置文件

```
强制:
  ├── vite.config.ts (TypeScript) — 不用 .js
  ├── 定义 resolve.alias 以支持简洁导入 (@/ → src/)
  ├── 开发环境配置 server.proxy 处理 API 调用 — 避免 CORS
  ├── 开发环境 build.sourcemap 设为 true, 生产设为 false
  └── 插件列表保持精简 — 每个插件增加构建时间
```

**正确**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
```

---

## 3. 构建优化

```
强制:
  ├── 用 React.lazy (或框架等效方案) 按路由代码分割
  ├── 为大型 vendor 库配置 manualChunks (react, lodash, chart libs)
  ├── 构建后检查 bundle 大小: npx vite-bundle-visualizer
  ├── Tree-shaking: 用命名导入 — 不用 barrel 文件的默认导入
  └── 必要时在配置中设置 chunk 大小警告阈值
```

**正确** — manual chunks:
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom'],
        query: ['@tanstack/react-query'],
      },
    },
  },
},
```

---

## 4. 路径别名和导入

```
强制:
  ├── 在 vite.config.ts AND tsconfig.json 中配置 @/ 别名 (两者必须一致)
  ├── 跨功能模块用 @/ — 同目录用相对路径
  ├── 绝不用深层相对路径 (../../../shared/lib/helpers)
  └── 功能模块公共 API 用 barrel 导出 (index.ts) — 不用于内部模块
```

**tsconfig.json** 必须匹配:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

---

## 5. 开发服务器

```
强制:
  ├── 用 server.proxy 处理后端 API — 绝不在 fetch 调用中硬编码 localhost URL
  ├── server.open 按需启用 — 不要强制
  ├── HMR 应该正常工作 — 如果不行，检查文件命名 (PascalCase 组件)
  └── 开发环境 HTTPS: 用 @vitejs/plugin-basic-ssl — 不用自签名证书
```

---

## 6. 测试集成

```
强制:
  ├── 用 Vitest (不用 Jest) — 共享 Vite 配置和转换管道
  ├── 在 vite.config.ts 或 vitest.config.ts 中配置 test 块
  ├── 组件测试设 environment: 'jsdom'
  ├── 测试中用相同的路径别名 — Vitest 继承自 vite.config
  └── 无兼容问题时用 happy-dom 代替 jsdom (更快)
```

**正确**
```typescript
// vite.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
```

---

## 7. 反模式

```
绝不做:
  ├── 客户端代码用 process.env (用 import.meta.env)
  ├── Secrets 放 VITE_ 环境变量 — 会进入 bundle
  ├── 能用 Vitest 时用 Jest — Vitest 更快且共享配置
  ├── 深层相对导入 (../../..) — 用 @/ 别名
  ├── 整个库导入 (import _ from 'lodash') — 用命名 (import { debounce })
  └── 禁用 HMR 来"修复"问题 — 找根因
```

---

## Vite 验证清单

- [ ] 所有客户端环境变量前缀为 VITE_
- [ ] VITE_ 变量中无 secrets
- [ ] 用 import.meta.env — 不用 process.env
- [ ] @/ 路径别名在 vite.config.ts 和 tsconfig.json 中一致配置
- [ ] API 调用配置了 server.proxy
- [ ] Bundle 已分析 — 无超大 chunk
- [ ] 配置了 Vitest (不用 Jest)
- [ ] .env.local 在 .gitignore 中
