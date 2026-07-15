# Firebase 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. Firestore 安全规则

```
强制:
  ├── 默认拒绝: 规则以 allow read, write: if false; 开头
  ├── 按集合和操作（read, create, update, delete）编写细粒度规则
  ├── 使用 request.auth.uid 进行用户范围访问 — 绝不信赖客户端发送的 ID
  ├── 在规则中验证数据形状: request.resource.data.field is string
  ├── 部署前使用 Firebase Emulator 测试规则
  └── 绝不在生产中使用 allow read, write: if true
```

**好**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId
        && request.resource.data.keys().hasOnly(['displayName', 'avatar', 'updatedAt'])
        && request.resource.data.displayName is string
        && request.resource.data.displayName.size() <= 100;
      allow create, delete: if false;
    }
  }
}
```

---

## 2. Firestore 数据建模

```
强制:
  ├── 为读取性能反规范化 — Firestore 按读取收费，不按字段
  ├── 对大型或无限列表使用子集合（messages, orders）
  ├── 对小型的、有界的一起读取的数据使用嵌入式对象
  ├── 在需要时存储文档 ID 作为字段用于查询
  ├── 使用服务器时间戳: serverTimestamp() — 不是客户端 Date.now()
  └── 绝不要创建深度嵌套的子集合层次结构（最多 2-3 层）
```

**好**
```typescript
// 用户文档 — 嵌入小型数据
{
  id: "user-123",
  displayName: "Jane Doe",
  email: "jane@example.com",
  settings: { theme: "dark", notifications: true },  // 嵌入 — 始终一起读取
  createdAt: serverTimestamp(),
}

// 订单 — 子集合（无限的，单独查询）
// /users/user-123/orders/{orderId}
```

---

## 3. Cloud Functions

```
强制:
  ├── 使用 v2 函数（onRequest, onCall, onDocumentWritten）— 不用 v1
  ├── 在所有 onCall 函数中验证所有输入 — 它们是公共端点
  ├── 设置每个函数的内存和超时限制
  ├── 对 API 密钥使用 secrets manager — 不是环境配置
  ├── 幂等设计 — 函数在失败时可能重试
  └── 保持函数专注 — 每个函数一个职责
```

**好**
```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';

const schema = z.object({ orderId: z.string().uuid() });

export const cancelOrder = onCall({ memory: '256MiB', timeoutSeconds: 30 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

  const parsed = schema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid input');

  await db.collection('orders').doc(parsed.data.orderId).update({ status: 'cancelled' });
  return { success: true };
});
```

---

## 4. 认证

```
强制:
  ├── 使用 Firebase Auth — 不要在其旁边构建自定义认证
  ├── 在 Firestore 中存储额外的用户数据 — 不在 Auth custom claims 中（限制为 1KB）
  ├── Custom claims 仅用于角色/权限（admin, moderator）
  ├── 使用 onAuthStateChanged 监听器处理认证状态
  ├── 登出清除本地状态 — 不要留下过时数据
  └── 绝不要将 Firebase API 密钥作为密钥存储 — 它们是公开的（安全规则保护数据）
```

---

## 5. 存储规则

```
强制:
  ├── 在规则中按文件类型和大小限制上传
  ├── 用户范围路径: /users/{userId}/avatar — 在规则中匹配
  ├── 验证内容类型: request.resource.contentType.matches('image/.*')
  ├── 在规则中设置最大文件大小: request.resource.size < 5 * 1024 * 1024
  └── 绝不允许存储的公共写访问
```

---

## 6. Emulator 和本地开发

```
强制:
  ├── 使用 Firebase Emulator Suite 进行本地开发
  ├── 部署前在 emulator 上测试安全规则
  ├── 通过 emulator import 植入数据 — 不是手动仪表板输入
  ├── CI 在 emulators 上运行测试 — 不是生产
  └── 绝不要从本地开发连接到生产
```

---

## 7. 反模式

```
绝不要:
  ├── 生产规则中使用 allow read, write: if true
  ├── 信任客户端发送的用户 ID — 使用 request.auth.uid
  ├── 深度子集合嵌套（4+ 层）
  ├── 大型文档（> 1MB）— 拆分为子集合
  ├── 没有查询限制地读取整个集合
  ├── 新代码使用 v1 Cloud Functions — 使用 v2
  ├── 在 Firebase 配置中存储密钥 — 使用 Secret Manager
  └── 对生产进行测试 — 使用 emulators
```

---

## Firebase 验证清单

- [ ] 安全规则默认拒绝，带细粒度每集合策略
- [ ] 使用 request.auth.uid 进行访问控制 — 不信任客户端 ID
- [ ] 为读取优化的数据模型（适当时反规范化）
- [ ] 无限列表使用子集合
- [ ] 带输入验证的 Cloud Functions v2
- [ ] 函数是幂等的
- [ ] 存储规则限制文件类型和大小
- [ ] 所有规则在 emulator 上测试
- [ ] 使用 serverTimestamp() — 不是客户端时间戳
- [ ] 生产中没有 allow read, write: if true
