# Supabase 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. 行级安全（RLS）

```
强制:
  ├── 每张表都启用 RLS — 没有例外
  ├── 默认拒绝: 启用 RLS 且无策略的表阻止所有访问
  ├── 按角色写策略: anon, authenticated, service_role
  ├── 用 auth.uid() 做用户范围策略 — 绝不信任客户端发送的用户 ID
  ├── 部署前用不同角色测试策略
  └── Service role 绕过 RLS — 仅服务端使用，绝不暴露 service key 到客户端
```

**好**
```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 用户可读取自己的 profile
CREATE POLICY "Users read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- 用户可更新自己的 profile
CREATE POLICY "Users update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 2. Auth 模式

```
强制:
  ├── 使用 Supabase Auth — 不自己构建自定义 auth
  ├── 用户元数据存在独立的 profiles 表 — 不在 auth.users 中
  ├── 注册时通过 database trigger 或 auth hook 创建 profile
  ├── RLS 策略中用 auth.uid() — 它是受信任的身份来源
  ├── 用 onAuthStateChange listener 处理 auth 状态变更
  └── 绝不将 service_role key 存客户端代码 — 它绕过 RLS
```

**好** — 注册时创建 profile 的 trigger:
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## 3. 客户端使用

```
强制:
  ├── 初始化一次客户端 — 从共享模块导出
  ├── 用生成类型的类型化客户端: supabase-js + supabase gen types
  ├── 每次 Supabase 调用都要处理错误 — 检查 { data, error } 响应
  ├── 用 .select() 指定列 — 生产环境绝不 .select('*')
  ├── 期望单行时用 .single() — 0 或 2+ 行会抛异常
  └── 每次迁移后重新生成类型: npx supabase gen types typescript
```

**好**
```typescript
const { data, error } = await supabase
  .from('user_profiles')
  .select('id, email, display_name, role')
  .eq('user_id', userId)
  .single();

if (error) throw new DatabaseError('Failed to fetch profile', error);
```

---

## 4. Edge Functions

```
强制:
  ├── 需要 secrets 或外部 API 调用的服务端逻辑使用 Edge Functions
  ├── 验证所有输入 — Edge Functions 是公共端点
  ├── 入口处用 Zod 或手动验证
  ├── 显式设置 CORS headers
  ├── 用正确的 HTTP 状态码处理错误
  └── 保持函数专注 — 一个函数一个功能
```

---

## 5. 实时功能

```
使用时:
  ├── 仅在需要的表上启用 realtime — 不是所有表
  ├── 带过滤订阅 — 减少消息量
  ├── 组件卸载时取消订阅 — 防止内存泄漏
  ├── 优雅处理重连
  └── RLS 应用到 realtime — 用户只收到他们能 SELECT 的行
```

**好**
```typescript
const channel = supabase
  .channel('user-orders')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` },
    (payload) => handleNewOrder(payload.new)
  )
  .subscribe();

// 清理
return () => { supabase.removeChannel(channel); };
```

---

## 6. 存储

```
强制:
  ├── 每种用例创建独立 bucket（头像、文档、上传）
  ├── 设置 bucket 级别访问策略（公开 vs 私有）
  ├── 上传前后验证文件类型和大小 — 客户端和服务端都要
  ├── 私有文件用 signed URLs 访问 — 不用公开 URL
  ├── 每个 bucket 设置文件大小限制
  └── 敏感文档绝不存公开 bucket
```

---

## 7. 迁移

```
强制:
  ├── 用 supabase db diff 或手动 SQL 文件做迁移
  ├── 一次迁移一个变更 — 不合并无关变更
  ├── 本地测试迁移: supabase db reset
  ├── 迁移后始终重新生成类型: supabase gen types typescript
  ├── RLS 策略包含在迁移文件中 — 不手动应用
  └── 种子数据放在独立 seed.sql 文件
```

---

## 8. 反模式

```
绝不要:
  ├── 客户端暴露 service_role key — 它绕过 RLS
  ├── 未启用 RLS 的表
  ├── 生产查询中用 .select('*')
  ├── 信任客户端发送的用户 ID — 用 auth.uid()
  ├── 用户数据存在 auth.users metadata 而非 profiles 表
  ├── 所有表启用 realtime — 选择性启用
  ├── 忽略 Supabase 调用中的 { error }
  └── Supabase dashboard 手动 SQL 而非迁移文件
```

---

## Supabase 验证清单

- [ ] 每张表启用 RLS 并有明确策略
- [ ] 策略中用 auth.uid() — 不信任客户端发送的用户 ID
- [ ] Service role key 仅服务端使用
- [ ] 类型化客户端带生成类型（supabase gen types）
- [ ] 指定列 select — 无 .select('*')
- [ ] 每次 Supabase 调用都有错误处理
- [ ] 卸载时清理 realtime 订阅
- [ ] Storage bucket 有访问策略和文件限制
- [ ] 迁移在版本控制中 — 非手动 dashboard SQL
- [ ] 每次迁移后重新生成类型
