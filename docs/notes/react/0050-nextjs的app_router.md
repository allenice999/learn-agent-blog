# Next.js App Router

App Router 的核心变化只有一句话：**默认所有组件都是服务端组件，只有需要交互时才加 `"use client"` 变成客户端组件**。你之前学的 Hooks（useState/useEffect/useContext）只存在于客户端组件里。

## 1 文件即路由：文件夹 = URL 路径

App Router 在 `app/` 目录下用**文件夹嵌套**定义路由，不需要写任何路由配置文件。

```
app/
├── layout.tsx          → 根布局（必须包含 html/body）
├── page.tsx            → 路由 /
├── blog/
│   ├── page.tsx        → 路由 /blog
│   └── [slug]/
│       └── page.tsx    → 路由 /blog/任意slug（动态路由）
└── dashboard/
    └── page.tsx        → 路由 /dashboard
```

**规则**：
- **文件夹**定义 URL 片段
- **`page.tsx`** 让该路由可公开访问（没有 page 的文件夹不产生路由）
- **`[slug]`** 方括号表示动态路由，`/blog/hello` 中 `slug = "hello"`

### 动态路由的读取

```tsx
// app/blog/[slug]/page.tsx
export default async function Page({ params }) {
  const { slug } = await params;   // 注意：params 是 Promise，需要 await
  return <h1>文章：{slug}</h1>;
}
```

在客户端组件里用 `useParams()` 获取，不要用 props 的 `params`（客户端组件拿到的 `params` 也是 Promise，要用 `use()` 解）。

## 2 layout vs page：共享与独特

| | `page.tsx` | `layout.tsx` |
|---|---|---|
| 作用 | 该路由**独有**的 UI | 多个页面**共享**的 UI |
| 是否必需 | 路由可访问必需 | 根布局必需，其他可选 |
| 导航时 | 重新渲染 | **不重新渲染**，保留状态 |
| 接收 | `params` / `searchParams` | `children`（子布局或页面） |

**布局是嵌套的**：根布局包裹子布局，子布局包裹页面。

```tsx
// app/layout.tsx —— 根布局，必须有 html 和 body
export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/blog/layout.tsx —— 只影响 /blog 下的页面
export default function BlogLayout({ children }) {
  return (
    <section>
      <nav>博客导航</nav>
      {children}   {/* 这里是 page 或更深层的 layout */}
    </section>
  );
}
```

访问 `/blog/hello` 时，渲染层级是：
```
RootLayout → BlogLayout → blog/[slug]/page.tsx
```

**关键点**：从 `/blog/a` 导航到 `/blog/b` 时，**两个 layout 都不重新渲染**，只有 page 换掉。这就是布局“保留状态”的含义。

## 3 Server vs Client Component：何时加 `"use client"`

**默认全是 Server Component。** 不加 `"use client"` 的组件：
- 代码**永远不会发送到浏览器**
- 不能使用 `useState`、`useEffect`、`onClick`、`localStorage`、`window` 等
- 可以直接 `await` 数据库/API 调用（因为跑在服务器上）

**什么时候必须加 `"use client"`**：

| 需要 | 例子 |
|------|------|
| 交互/事件处理 | `onClick`、`onChange`、`onSubmit` |
| React Hooks | `useState`、`useEffect`、`useRef`、`useContext` |
| 浏览器 API | `localStorage`、`window`、`navigator` |
| 自定义 Hook（内部用了上述） | 任何依赖客户端能力的 Hook |

```tsx
"use client";   // 必须在文件第一行，import 之前

import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### `"use client"` 的边界效应

一旦一个文件标了 `"use client"`，**它 import 的所有组件都变成客户端组件**，不需要每个文件都重复加。

**但这不适用于通过 `children` 或 props 传入的 Server Component**。这是 App Router 最重要的组合模式：

```tsx
// Modal.tsx —— 客户端组件（需要 useState 控制开关）
"use client";
import { useState } from "react";

export default function Modal({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>打开</button>
      {open && <div className="modal">{children}</div>}
    </>
  );
}
```

```tsx
// page.tsx —— Server Component
import Modal from "./Modal";
import Cart from "./Cart";   // Cart 是 Server Component，在服务端取数据

export default async function Page() {
  return (
    <Modal>
      <Cart />   {/* ✅ Cart 仍然是 Server Component！ */}
    </Modal>
  );
}
```

`Cart` 在服务端渲染好，以 RSC Payload 的形式传给客户端的 `Modal`，**不会被打进客户端 JS 包**。这就是“服务端组件作为 children 传给客户端组件”的标准模式。

## 4 与你前面学的 Hooks 的连接

**前面学的所有 Hooks，只能在客户端组件里用。**

| 你想用的 | 组件类型 | 需要加 `"use client"` 吗 |
|---------|---------|------------------------|
| `useState` / `useEffect` / `useRef` | Client | ✅ |
| `useContext`（读 Context） | Client | ✅ |
| `useMemo` / `useCallback` | Client | ✅ |
| 受控表单（`value` + `onChange`） | Client | ✅ |
| 事件回调 `onClick` | Client | ✅ |
| 纯展示（无交互） | Server | ❌ 不加 |
| 取数据（`await fetch`） | Server | ❌ 不加 |

**你的待办清单组件**在 App Router 里必须拆成两部分：
- **页面壳**（Server Component）：负责布局、取初始数据
- **交互部分**（Client Component）：输入框、按钮、列表的增删改

## 5 Context 在 App Router 中的限制

Context在 Server Component 中**不能用**。React context 不支持在 Server Component 里创建或消费。

**正确做法**：创建一个客户端 Provider 组件，在根布局里包住 `{children}`：

```tsx
// app/providers.tsx
"use client";
import { createContext, useState, useMemo } from "react";

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

```tsx
// app/layout.tsx（Server Component）
import { ThemeProvider } from "./providers";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

**Provider 尽可能深地包裹**（只包 `{children}`，不要包整个 `<html>`），让 Next.js 能优化静态部分。

## 6 `"use client"` 放哪：叶子级，不是页面级

**最常见的错误**：因为页面上有一个按钮，就把整个 `page.tsx` 标成 `"use client"`。这会让整页（包括所有纯展示内容）都变成客户端组件，JS 包暴增。

**正确做法**：把交互部分抽成独立的叶子组件，只给它加 `"use client"`。

```tsx
// ❌ 错误：整页变成客户端组件
"use client";
export default function Page() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <h1>产品列表</h1>
      <ProductList />       {/* 本来是 Server Component，现在被迫进客户端包 */}
      <button onClick={() => setOpen(!open)}>筛选</button>
    </div>
  );
}
```

```tsx
// ✅ 正确：只有按钮是客户端组件
import FilterButton from "./FilterButton";   // "use client"
import ProductList from "./ProductList";     // Server Component

export default function Page() {
  return (
    <div>
      <h1>产品列表</h1>
      <ProductList />        {/* 留在服务端 */}
      <FilterButton />
    </div>
  );
}
```

**原则**：`"use client"` 下推到尽可能深的叶子组件，让静态部分留在服务端。

## 🏋️ 练习

**练习 1**：用 App Router 的文件结构，为以下 URL 设计目录：
- `/`（首页）
- `/about`
- `/blog`（博客列表）
- `/blog/[slug]`（文章详情）
- `/dashboard` 下所有页面共享一个侧边栏

**练习 2**：下面哪些需要 `"use client"`？
1. 一个显示文章列表的组件（数据来自 `await fetch`）
2. 一个搜索框，输入时实时过滤已加载的列表
3. 一个 `<Link>` 导航链接
4. 一个切换深色模式的按钮

答案

1. ❌ Server（服务端取数据）
2. ✅ Client（受控输入 + 状态）
3. ❌ Server（`<Link>` 在服务端可用）
4. ✅ Client（`onClick` + state）

**练习 3**：把待办清单改造成 App Router 结构：
- `app/page.tsx`：Server Component，只渲染布局和一个 `<TodoApp />`
- `app/TodoApp.tsx`：`"use client"`，包含输入框、列表、增删改逻辑

---

## 记忆卡

| 概念 | 一句话 |
|------|--------|
| 文件即路由 | 文件夹 = URL 路径，`page.tsx` 让路由可访问 |
| layout | 共享 UI，导航时不重渲染，接收 `children` |
| 根 layout | 必须有，包含 `<html>` 和 `<body>` |
| Server Component | 默认，代码不进浏览器，可用 `await` 取数据 |
| Client Component | 加 `"use client"`，可用 Hooks / 事件 / 浏览器 API |
| 边界规则 | `"use client"` 下推，但通过 `children` 传入的 Server Component 不受影响 |
| Context | 只能在 Client Component 里用，Provider 放客户端文件，在 layout 里包 `{children}` |
