# Vue 规范

这些规则是**强制性的**。违反即任务失败。无例外。

---

## 1. 组合式 API

```
强制:
  ├── 用 <script setup> (组合式 API) — 新代码绝不用 Options API
  ├── 基本类型用 ref(), 对象用 reactive()
  ├── 派生值用 computed() — 绝不在 ref 中存储派生数据
  ├── 可复用逻辑用 composables (useXxx) — 从组件中提取
  └── 绝不用 this. — 组合式 API 不使用它
```

**禁止** — Options API:
```vue
<script>
export default {
  data() { return { count: 0 }; },
  methods: { increment() { this.count++; } },
};
</script>
```

**正确** — 组合式 API:
```vue
<script setup lang="ts">
import { ref } from 'vue';
const count = ref(0);
const increment = () => count.value++;
</script>
```

---

## 2. 状态管理 — Pinia

```
强制:
  ├── Pinia 用于全局状态 — 不用 Vuex
  ├── 每个领域一个 store (useUserStore, useCartStore)
  ├── 用 Setup Stores 语法 (函数式) — 与组合式 API 一致
  ├── 服务端数据: 优先 VueQuery (@tanstack/vue-query) — 不用 Pinia
  └── 绝不在组件中直接修改 store 状态 — 用 actions
```

**正确**
```typescript
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isLoggedIn = computed(() => !!user.value);

  async function login(credentials: LoginCredentials) {
    user.value = await authService.login(credentials);
  }

  function logout() {
    user.value = null;
  }

  return { user, isLoggedIn, login, logout };
});
```

---

## 3. 组件设计

```
强制:
  ├── 每个 SFC 最多 150 行 — 提取子组件
  ├── 顺序: <script setup> → <template> → <style scoped>
  ├── 每个 .vue 文件一个组件
  ├── Props: 用 defineProps + TypeScript interface
  ├── Emits: 用 defineEmits + TypeScript
  ├── 用 v-bind 缩写 (:prop) 和 v-on 缩写 (@event)
  └── 模板中无业务逻辑 — 在 <script setup> 中计算
```

**正确**
```vue
<script setup lang="ts">
interface Props {
  title: string;
  variant?: 'primary' | 'secondary';
}
const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
});
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', data: FormData): void;
}>();
</script>
```

---

## 4. 路由 — Vue Router

```
强制:
  ├── 路由定义集中在 router/index.ts
  ├── 懒加载路由组件 — () => import('./views/XxxView.vue')
  ├── 导航用命名路由 — 绝不在组件中硬编码路径
  ├── 认证导航守卫在 router.beforeEach — 不在组件中
  ├── 用 defineProps 或 useRoute().params 类型化路由参数
  └── 必须有通配 404 路由: { path: '/:pathMatch(.*)*' }
```

---

## 5. 模板规则

```
强制:
  ├── 很少切换的内容用 v-if (频繁切换用 v-show)
  ├── 绝不在同一元素上用 v-if 和 v-for — 用 <template v-if> 包裹
  ├── 所有 v-for 用 :key — 稳定的唯一 ID, 不用数组索引
  ├── 事件向上传递, props 向下传递 — 绝不变异 props
  ├── 用 <slot> 做可组合组件 API — 不用过多 props
  └── 用 <Teleport> 处理模态框/通知 — 不用 DOM 操作
```

**禁止** — 同一元素上 v-if + v-for:
```vue
<li v-for="user in users" v-if="user.active" :key="user.id">
```

**正确**
```vue
<template v-for="user in users" :key="user.id">
  <li v-if="user.active">{{ user.name }}</li>
</template>
```

或更好 — 用 computed:
```typescript
const activeUsers = computed(() => users.value.filter(u => u.active));
```

---

## 6. Composables (自定义 Hooks)

```
强制:
  ├── 命名: useXxx (useAuth, useUsers, useDebounce)
  ├── 文件位置: composables/ 目录
  ├── 返回响应式 ref 和函数 — 消费者决定如何使用
  ├── 在 onUnmounted 中处理清理 — 不泄漏定时器或监听器
  └── 每个 composable 只处理一个关注点
```

---

## 7. 反模式

```
绝不做:
  ├── 新代码用 Options API (用组合式 API + <script setup>)
  ├── 新代码用 Vuex (用 Pinia)
  ├── 同一元素上 v-if + v-for
  ├── 变异 props — 用 emit 事件
  ├── 用 $refs 父子通信 — 用 props/emits
  ├── 直接 DOM 操作 (document.querySelector) — 用模板 ref
  ├── 派生数据用 watchers — 用 computed()
  ├── 已提交代码中有 console.log
  └── <script setup> 中用 this. — 它不存在
```

---

## Vue 验证清单

- [ ] 组合式 API 用 `<script setup>` — 无 Options API
- [ ] 全局状态用 Pinia — 无 Vuex
- [ ] 服务端数据用 VueQuery (如适用)
- [ ] Props 用 TypeScript interface 通过 defineProps 定义
- [ ] Emits 用 TypeScript 通过 defineEmits 定义
- [ ] 组件低于 150 行
- [ ] 路由组件懒加载
- [ ] 同一元素上无 v-if + v-for
- [ ] 所有 v-for 有稳定 :key — 不用数组索引
- [ ] 认证在路由守卫处理 — 不在组件中
- [ ] 已提交代码中无 console.log
