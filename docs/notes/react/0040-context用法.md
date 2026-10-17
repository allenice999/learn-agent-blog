# 深层嵌套通信：Context

## 一、先看它解决什么问题

假设你有这样一棵组件树：

```
App
 └─ Layout
     └─ Sidebar
         └─ Menu
             └─ MenuItem
                 └─ Button   ← 这里需要用 theme
```

`theme` 这个数据在 `App` 里，但 `Button` 要用。按常规做法，得一层层传 props：

```jsx
function App() {
  return <Layout theme="dark" />;
}
function Layout({ theme }) {
  return <Sidebar theme={theme} />;
}
function Sidebar({ theme }) {
  return <Menu theme={theme} />;
}
function Menu({ theme }) {
  return <MenuItem theme={theme} />;
}
function MenuItem({ theme }) {
  return <Button theme={theme} />;
}
function Button({ theme }) {
  return <button className={theme}>点</button>;
}
```

**问题很明显**：

- 中间的 `Layout`、`Sidebar`、`Menu`、`MenuItem` **根本不用 theme**，却被迫接收、转发
- 这叫 **prop drilling（属性钻取）**
- 层级越深越痛苦；中间某层想改名、加字段，全链路都得改

**Context 就是来解决"跨层级传递"的。** 它让数据**跳过中间层，直接到达需要的组件**。

## 二、Context 的三个部件

```jsx
// 1. 创建：给个默认值（当没有 Provider 时用）
const ThemeContext = createContext("light");

// 2. 提供：在祖先处用 Provider 包住子树，value 就是共享数据
<ThemeContext.Provider value="dark">
  <DeepTree />
</ThemeContext.Provider>

// 3. 消费：在任意后代用 useContext 直接取
const theme = useContext(ThemeContext);
```

一句话：**祖先 `Provider` 提供，后代 `useContext` 消费，中间层完全不用管。**

用 Context 重写上面的例子：

```jsx
const ThemeContext = createContext("light");

function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Layout />          {/* 注意：不再传 theme 了 */}
    </ThemeContext.Provider>
  );
}

function Layout() { return <Sidebar />; }
function Sidebar() { return <Menu />; }
function Menu() { return <MenuItem />; }
function MenuItem() { return <Button />; }

function Button() {
  const theme = useContext(ThemeContext);   // 直接拿，跨 5 层
  return <button className={theme}>点</button>;
}
```

中间四层**完全不用碰 theme**，清爽了。

## 三、完整可跑的例子

Context 除了"读"，还能配合"改"一起提供，典型模式是**把 state 和 setState 都放进 value**：

```jsx
import { createContext, useContext, useState } from "react";

// 1. 创建（默认值通常给 null，强制要求用 Provider 包裹）
const ThemeContext = createContext(null);

function App() {
  const [theme, setTheme] = useState("light");

  return (
    // 2. 提供：value 里同时放"值"和"修改函数"
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Toolbar />
      <Content />
    </ThemeContext.Provider>
  );
}

function Toolbar() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
      切换主题（当前：{theme}）
    </button>
  );
}

function Content() {
  const { theme } = useContext(ThemeContext);   // 跨层级直接读
  return (
    <div style={{ background: theme === "dark" ? "#333" : "#fff",
                  color: theme === "dark" ? "#fff" : "#000" }}>
      内容区
    </div>
  );
}
```

**关键点**：

- `value={{ theme, setTheme }}` —— 把"数据 + 修改方式"一起给后代
- 后代既能读 `theme`，也能调 `setTheme` 改
- **但真正的 state 仍在 `App` 里**，改还是由 `App` 的 `setTheme` 完成

## 四、Context 和单向数据流的关系（重要）

很多人以为 Context 打破了单向数据流，**恰恰相反**：

```
App（持有 state）
  │  Provider 提供 value
  ▼
后代（useContext 读）
  │  用户操作 → 调 value 里的回调/setState
  ▼
App 改 state → 重新渲染 → Provider value 更新 → 后代收到新值
```

**数据仍然从"上"流向"下"**，只是传输方式从"逐层 props"变成了"Provider 广播"。

- Context **没有**让子组件直接改父数据
- 子组件要改，还是通过**祖先提供的回调**（比如 `setTheme`）
- 改数据的**唯一源头**依然是持有 state 的祖先

**所以 Context 是单向数据流的"加速通道"，不是破坏者。**

## 五、Context 的典型使用场景

| 场景 | 例子 |
|------|------|
| 主题 | light/dark、配色 |
| 国际化 | 当前语言、翻译函数 |
| 用户信息 | 当前登录用户、权限 |
| 全局配置 | 组件库的 size、locale |
| 路由 | React Router 的 context |

**判断要不要用 Context**：这个数据**很多不同层级的组件都要用，且变化不频繁**。如果一个数据只给一两个紧邻的子组件，直接 props 就行，别上 Context。

## 六、Context 的陷阱

### 陷阱 1：Provider 的 value 每次渲染都是新对象 → 全体消费者重渲染

```jsx
// ❌ 每次 App 渲染，{ theme, setTheme } 都是新对象
<ThemeContext.Provider value={{ theme, setTheme }}>
```

`value` 引用变了，**所有用 `useContext` 的后代都会重新渲染**，即使 `theme` 没变。

**修法：用 `useMemo` 稳定 value**：

```jsx
const value = useMemo(() => ({ theme, setTheme }), [theme]);
<ThemeContext.Provider value={value}>
```

### 陷阱 2：所有消费者共享一个 Context，粒度太粗

一个 Context 的 value 变了，**所有**消费者都重渲染。如果 Context 里混了"频繁变"和"不常变"的数据，会让不相关的组件被牵连。

**修法**：拆成多个 Context，按更新频率/用途分离。

### 陷阱 3：默认值容易误用

```jsx
const Ctx = createContext("light");   // 默认 "light"
```

如果**忘了包 Provider**，组件会用默认值，而不是报错——bug 很隐蔽。

**修法**：默认值给 `null`，消费时判断并抛错：

```jsx
const Ctx = createContext(null);

function useTheme() {
  const ctx = useContext(Ctx);
  if (ctx === null) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return ctx;
}
```

### 陷阱 4：什么都往 Context 塞

Context 不是"全局状态管理器"。它解决的是**跨层级传递**，不是"所有状态都放这"。滥用会让组件变得"隐形依赖"——看组件代码不知道它依赖了哪些 Context，难维护。

## 七、Context 的封装惯例

真实项目里，通常把 Provider 和 hook 封装起来，对外只暴露一个自定义 hook：

```jsx
const ThemeContext = createContext(null);

// Provider 封装，顺带 useMemo 优化
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// 对外暴露 hook，内部做空值检查
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return ctx;
}

// 使用处
function Button() {
  const { theme, setTheme } = useTheme();
  return <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>
    {theme}
  </button>;
}
```

**这是社区标准做法**：外部看不到 `Context` 对象本身，只用 `ThemeProvider` 和 `useTheme`，封装性好、能加校验、能优化。

## 八、Context vs 其他通信方式

| 方式 | 适用场景 | 数据方向 |
|------|---------|---------|
| props | 父子、相邻组件 | 父→子 |
| 回调 props | 子通知父 | 子→父（事件） |
| 状态提升 | 兄弟共享 | 提到共同父级 |
| **Context** | **跨多层、多组件共享** | **祖先→后代（广播）** |
| 全局状态库（Zustand/Redux） | 复杂全局状态 | 任意 |

**优先级**：props → 状态提升 → Context → 全局库。能用简单的就别上重的。


## 九、一句话总结

> **Context = 跨层级传数据的广播通道。** 祖先用 `Provider` 提供，后代用 `useContext` 消费，中间层不用参与。它**不破坏单向数据流**——数据来源仍是祖先，改数据仍靠祖先给的回调。用的时候注意：**value 引用要稳定（useMemo）、粒度别太粗、别当全局状态库滥用**。

# 怎么拆成多个 Context

"拆 Context"的核心目的是**控制重渲染的粒度**：一个 Context 的 value 变了，只有真正关心这份数据的组件才应该重新渲染。我分三步讲：为什么要拆、怎么拆、拆完怎么用。

## 一、先理解"为什么要拆"

假设你把所有全局数据塞进一个 Context：

```jsx
// ❌ 大杂烩
const AppContext = createContext(null);

function AppProvider({ children }) {
  const [user, setUser] = useState(null);       // 不常变
  const [theme, setTheme] = useState("light");  // 偶尔变
  const [mouse, setMouse] = useState({x:0,y:0}); // 高频变！

  const value = { user, setUser, theme, setTheme, mouse, setMouse };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
```

问题：

- `mouse` 每秒变几十次 → **value 每次都新建** → `AppProvider` 重渲染
- **所有** `useContext(AppContext)` 的组件都跟着重渲染
- 一个只关心 `theme` 的按钮，因为鼠标动了而疯狂重渲染

**这就是"粒度太粗"**。拆 Context 就是把"变化频率/用途不同"的数据分开，让它们互不牵连。

## 二、拆分的三个维度

### 维度 1：按"变化频率"拆

**高频变化**和**低频变化**的数据分开。

```jsx
const ThemeContext = createContext(null);   // 偶尔变
const MouseContext = createContext(null);   // 高频变
```

这样鼠标动时，只有 `MouseContext` 的消费者重渲染，`ThemeContext` 的消费者不受影响。

### 维度 2：按"用途/领域"拆

**用户相关**和**主题相关**分开，语义清晰：

```jsx
const UserContext = createContext(null);
const ThemeContext = createContext(null);
const LocaleContext = createContext(null);
```

### 维度 3：按"读写分离"拆（进阶）

**只读的值**和**修改函数**分开。因为 `setState` 函数引用是稳定的（React 保证），把 setter 单独放一个 Context，可以让"只调 setter、不读值"的组件完全不被值变化影响。

```jsx
const ThemeValueContext = createContext("light");
const ThemeActionsContext = createContext(null);   // 只放 setTheme
```

> 这个模式叫 **"state / dispatch 分离"**，Redux 也是这样设计的（`useSelector` 读 state，`useDispatch` 拿 dispatch，dispatch 永远稳定）。

## 三、完整示例：从"大杂烩"拆到"三件套"

### 第一步：定义多个 Context

```jsx
// contexts.js
import { createContext, useContext, useState, useMemo, useCallback } from "react";

const UserContext = createContext(null);
const ThemeContext = createContext(null);
const ThemeActionsContext = createContext(null);

export { UserContext, ThemeContext, ThemeActionsContext };
```

### 第二步：Provider 组合（用嵌套 Provider 包多个 Context）

```jsx
// providers.jsx
import { UserContext, ThemeContext, ThemeActionsContext } from "./contexts";

export function AppProviders({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState("light");

  // 每个 Context 的 value 各自 useMemo，互不影响
  const userValue = useMemo(() => ({ user, setUser }), [user]);
  const themeValue = useMemo(() => theme, [theme]);

  // setter 引用稳定，单独 memo 一次（其实 setTheme 本身稳定，包一层也无妨）
  const themeActions = useMemo(() => ({ setTheme }), []);

  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>
        <ThemeActionsContext.Provider value={themeActions}>
          {children}
        </ThemeActionsContext.Provider>
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}
```

**关键**：

- 三个 Provider **嵌套**，每个管一份数据
- **每个 value 单独 `useMemo`** —— 这是核心，`user` 变不会让 `themeValue` 变
- setter（`setTheme`）引用稳定，单独放一个 Context

### 第三步：消费端按需取

```jsx
// 只关心主题值的组件
function ThemedText() {
  const theme = useContext(ThemeContext);
  console.log("ThemedText 渲染");
  return <p className={theme}>文字</p>;
}

// 只关心"改主题"的组件
function ToggleButton() {
  const { setTheme } = useContext(ThemeActionsContext);
  console.log("ToggleButton 渲染");
  return <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>
    切换主题
  </button>;
}

// 只关心用户的组件
function UserName() {
  const { user } = useContext(UserContext);
  console.log("UserName 渲染");
  return <p>{user?.name}</p>;
}
```

**效果**：

- 切换主题 → 只有 `ThemedText` 重渲染（读了 `ThemeContext`）
- `ToggleButton` **不**重渲染（它只读 `ThemeActionsContext`，而 setter 引用没变）
- `UserName` **不**重渲染（`UserContext` 没变）

这就是"拆"的价值。

### 第四步：封装成自定义 hook（对外统一）

```jsx
// 对外暴露的 hook，内部做空值检查
export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser 必须在 AppProviders 内使用");
  return ctx;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme 必须在 AppProviders 内使用");
  return ctx;
}

export function useThemeActions() {
  const ctx = useContext(ThemeActionsContext);
  if (!ctx) throw new Error("useThemeActions 必须在 AppProviders 内使用");
  return ctx;
}
```

使用：

```jsx
function ToggleButton() {
  const { setTheme } = useThemeActions();   // 只拿 setter，不拿值
  return <button onClick={() => setTheme(...)}>切换</button>;
}
```

## 四、读写分离的"完整版"：state + dispatch

如果你想要更彻底，把"读"和"写"拆成两个 Context，用 `useReducer` 管理复杂状态：

```jsx
const TodosStateContext = createContext(null);
const TodosDispatchContext = createContext(null);

function TodosProvider({ children }) {
  const [todos, dispatch] = useReducer(todosReducer, []);

  return (
    <TodosStateContext.Provider value={todos}>
      <TodosDispatchContext.Provider value={dispatch}>
        {children}
      </TodosDispatchContext.Provider>
    </TodosStateContext.Provider>
  );
}

// 消费端
function TodoList() {
  const todos = useContext(TodosStateContext);    // 读数据 → 数据变了才重渲染
  const dispatch = useContext(TodosDispatchContext); // 拿 dispatch → 引用永远稳定
  // ...
}

function AddButton() {
  const dispatch = useContext(TodosDispatchContext); // 只拿 dispatch
  // 只调 dispatch → 永远不因为 todos 变化而重渲染！
  return <button onClick={() => dispatch({type:"add"})}>添加</button>;
}
```

**优势**：`dispatch` 引用恒定不变（React 保证 `useReducer` 的 dispatch 稳定），所以像 `AddButton` 这种"只写不读"的组件，**永不被 todos 的变化牵连**。

## 五、拆分的"不要过度"

拆 Context 也不是越细越好。判断标准：

| 情况 | 要不要拆 |
|------|---------|
| 两个数据**变化频率差异大**（高频+低频） | ✅ 拆 |
| 两个数据**完全无关**（用户 vs 主题） | ✅ 拆 |
| 组件**只写不读**，需要免于重渲染 | ✅ 读写分离 |
| 两个数据**总是一起变、一起用** | ❌ 别拆 |
| 只影响一两个紧邻组件 | ❌ 根本别用 Context，用 props |

**过度拆分的代价**：Provider 层层嵌套、代码变长、理解成本上升。**先写简单版，遇到性能问题再拆。**

## 六、Provider 嵌套太深怎么办

拆多了会出现这种"俄罗斯套娃"：

```jsx
<A><B><C><D>{children}</D></C></B></A>
```

两个优化方向：

### 方法 1：写一个组合组件（推荐）

```jsx
function AppProviders({ children }) {
  return (
    <UserProvider>
      <ThemeProvider>
        <LocaleProvider>
          {children}
        </LocaleProvider>
      </ThemeProvider>
    </UserProvider>
  );
}

// 使用处只写一个
<AppProviders>
  <App />
</AppProviders>
```

### 方法 2：用 reduce 动态组合（组件多时）

```jsx
const providers = [UserProvider, ThemeProvider, LocaleProvider];

function AppProviders({ children }) {
  return providers.reduceRight(
    (acc, Provider) => <Provider>{acc}</Provider>,
    children
  );
}
```

两种都行，方法 1 可读性更好，方法 2 更"工程化"。

## 七、一个决策流程图

```
要跨层级传数据？
  ├─ 否 → 用 props / 状态提升
  └─ 是 → 用 Context
        └─ 要拆吗？
              ├─ 数据变化频率差异大？ → 拆
              ├─ 领域无关？ → 拆
              ├─ 有"只写不读"的组件？ → 读写分离
              └─ 数据总是一起用？ → 不拆，一个 Context 就够
```

## 八、一句话总结

> **拆 Context 的本质是按"变化频率/用途"把数据分组，让一份数据变化只影响真正关心它的组件。** 核心手段是：**多个 Provider 嵌套 + 每个 value 独立 `useMemo` + 必要时读写分离**。但要避免过度拆分——**先简单，后优化**。

## 九、对照你的学习路线

这个知识点把前面串起来了：

- `createContext` / `useContext`（Context 基础）
- `useMemo`（稳定 value 引用，**这就是"useMemo 真正有价值的场景"**）
- `useCallback`（稳定函数引用）
- 单向数据流（Context 是加速通道，不是破坏者）
- `useReducer`（读写分离时的搭档，可选）
