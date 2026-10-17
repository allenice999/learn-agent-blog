# useReducer vs Zustand：同一个待办清单，两种写法

用同一个待办清单功能，分别用 `useReducer` 和 Zustand 实现，然后对比它们的**代码结构、重渲染行为、跨组件能力**。

## 一、useReducer 版

`useReducer` 是 React 内置的，**状态跟着组件走**，要跨组件共享就得配合 Context。

### 1. 定义 reducer（纯函数）

```jsx
// todosReducer.js
export function todosReducer(state, action) {
  switch (action.type) {
    case "add":
      return [...state, { id: Date.now(), text: action.text, done: false }];
    case "toggle":
      return state.map(t =>
        t.id === action.id ? { ...t, done: !t.done } : t
      );
    case "remove":
      return state.filter(t => t.id !== action.id);
    default:
      return state;
  }
}
```

**特点**：所有状态转换逻辑集中在一个纯函数里，可单独测试。

### 2. 用 useReducer + Context 共享

```jsx
// TodoProvider.jsx
import { createContext, useContext, useReducer, useMemo } from "react";
import { todosReducer } from "./todosReducer";

const StateContext = createContext(null);
const DispatchContext = createContext(null);

export function TodoProvider({ children }) {
  const [todos, dispatch] = useReducer(todosReducer, []);

  // 读写分离：dispatch 引用稳定，只有 todos 变时 StateContext 才更新
  return (
    <StateContext.Provider value={todos}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export const useTodos = () => useContext(StateContext);
export const useTodoDispatch = () => useContext(DispatchContext);
```

### 3. 消费端

```jsx
// AddTodo.jsx —— 只写不读
function AddTodo() {
  const dispatch = useTodoDispatch();   // 只拿 dispatch
  const [text, setText] = useState("");

  const add = () => {
    if (!text.trim()) return;
    dispatch({ type: "add", text });
    setText("");
  };

  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} />
      <button onClick={add}>添加</button>
    </div>
  );
}

// TodoList.jsx —— 只读
function TodoList() {
  const todos = useTodos();
  const dispatch = useTodoDispatch();

  return (
    <ul>
      {todos.map(t => (
        <li key={t.id}>
          <span
            style={{ textDecoration: t.done ? "line-through" : "none" }}
            onClick={() => dispatch({ type: "toggle", id: t.id })}
          >
            {t.text}
          </span>
          <button onClick={() => dispatch({ type: "remove", id: t.id })}>
            删除
          </button>
        </li>
      ))}
    </ul>
  );
}

// App.jsx
function App() {
  return (
    <TodoProvider>
      <AddTodo />
      <TodoList />
    </TodoProvider>
  );
}
```

### useReducer 版的问题

1. **必须包 Provider**：组件树要套一层，否则 `useContext` 拿不到。
2. **重渲染粒度粗**：`todos` 一变，**所有** `useTodos()` 的组件都重渲染。哪怕某个组件只关心"待办总数"，它也会因为某一条的 `done` 变化而重渲染。
3. **逻辑分散**：reducer 一个文件、Provider 一个文件、hook 一个文件，小功能也要拆三个文件。
4. **异步/副作用处理麻烦**：想在"添加待办"后调 API，reducer 必须是纯函数，不能直接放副作用，得在组件里手动处理。

## 二、Zustand 版

Zustand 是**外部 store**，状态**不依赖组件树**，任何地方都能直接用。

### 1. 定义 store（一个文件搞定）

```jsx
// todoStore.js
import { create } from "zustand";

export const useTodoStore = create((set) => ({
  todos: [],

  addTodo: (text) =>
    set((state) => ({
      todos: [...state.todos, { id: Date.now(), text, done: false }],
    })),

  toggleTodo: (id) =>
    set((state) => ({
      todos: state.todos.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t
      ),
    })),

  removeTodo: (id) =>
    set((state) => ({
      todos: state.todos.filter((t) => t.id !== id),
    })),
}));
```

**特点**：状态 + 修改方法 + 初始值**全在一个对象里**，不需要 Provider，不需要 reducer 的 `switch`。

### 2. 消费端（直接用，不套 Provider）

```jsx
// AddTodo.jsx
import { useState } from "react";
import { useTodoStore } from "./todoStore";

function AddTodo() {
  const addTodo = useTodoStore((s) => s.addTodo);   // selector：只订阅 addTodo
  const [text, setText] = useState("");

  const add = () => {
    if (!text.trim()) return;
    addTodo(text);
    setText("");
  };

  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} />
      <button onClick={add}>添加</button>
    </div>
  );
}
```

```jsx
// TodoList.jsx
import { useTodoStore } from "./todoStore";

function TodoList() {
  const todos = useTodoStore((s) => s.todos);       // 只订阅 todos
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const removeTodo = useTodoStore((s) => s.removeTodo);

  return (
    <ul>
      {todos.map((t) => (
        <li key={t.id}>
          <span
            style={{ textDecoration: t.done ? "line-through" : "none" }}
            onClick={() => toggleTodo(t.id)}
          >
            {t.text}
          </span>
          <button onClick={() => removeTodo(t.id)}>删除</button>
        </li>
      ))}
    </ul>
  );
}
```

```jsx
// App.jsx —— 无需 Provider
function App() {
  return (
    <>
      <AddTodo />
      <TodoList />
    </>
  );
}
```

**甚至可以在组件外调用**：

```js
// 任何非组件代码里都能用
useTodoStore.getState().addTodo("来自组件的文字");
```

## 三、关键区别对比

| 维度 | useReducer（+ Context） | Zustand |
|------|------------------------|---------|
| 状态归属 | 组件树内部，**跟 Provider 绑定** | **外部 store**，独立于组件树 |
| 是否需 Provider | ✅ 必须包，否则拿不到 | ❌ 不需要 |
| 跨组件共享 | 靠 Context，受组件树限制 | 任意地方 `useTodoStore()` |
| 组件外访问 | ❌ 不行（只能在组件/hook 里） | ✅ `getState()` / `setState()` |
| 重渲染粒度 | 粗：value 变 → **所有消费者**重渲染 | 细：selector 选的变了才重渲染 |
| 逻辑位置 | reducer（纯函数）+ Provider + hook，分散 | 一个 store 文件，集中 |
| 异步/副作用 | reducer 必须纯，副作用得在组件处理 | action 里可以直接 `await fetch` |
| 调试 | React DevTools 看 state | Redux DevTools 插件，时间旅行 |
| 体积 | 0（内置） | ~1KB |
| 适用规模 | 中小型、局部共享 | 中大型、全局状态 |

## 四、用"重渲染"直观感受差别

加一个**只显示待办总数**的组件：

```jsx
function TodoCount() {
  const todos = useTodos();     // useReducer 版
  console.log("TodoCount 渲染");
  return <p>共 {todos.length} 条</p>;
}
```

**useReducer + Context**：只要 `todos` 数组变了（比如某条 `done` 切换），`TodoCount` 就重渲染。**即使总数没变**，因为它订阅的是整个 `todos`。

**Zustand**：改用 selector 只订阅数量：

```jsx
function TodoCount() {
  const count = useTodoStore((s) => s.todos.length);   // 只订阅长度
  console.log("TodoCount 渲染");
  return <p>共 {count} 条</p>;
}
```

切换某条的 `done` 时，`todos` 数组变了，但 `todos.length` **没变** → Zustand **不触发** `TodoCount` 重渲染。

> **这就是 Zustand 的核心优势**：基于 selector 的**细粒度订阅**，天然避免了 Context "一变全变"的问题。

## 五、什么时候用哪个

**用 useReducer：**
- 状态只在一个组件或一个小范围里
- 状态转换逻辑复杂（多个字段联动、多种 action）
- 不想引入第三方库
- 配合 Context 做**小范围**共享（如一个表单区域、一个弹窗）

**用 Zustand：**
- 状态要**跨页面、跨远距离组件**共享（如用户信息、购物车、主题）
- 需要**细粒度重渲染控制**
- 想要**组件外**也能读写状态
- action 里要处理异步（调 API、读 localStorage）

**一句话**：`useReducer` 是"**组件内的状态机**"，Zustand 是"**应用级的轻量 store**"。前者内置、适合局部；后者外部、适合全局。

## 六、两者可以共存

真实项目里常见组合：
- **本地 UI 状态**（输入框内容、弹窗开关）→ `useState`
- **组件内复杂状态**（表单校验逻辑）→ `useReducer`
- **全局共享状态**（用户、购物车、主题）→ Zustand
- **服务端数据缓存** → React Query / SWR

不需要二选一，**按状态的作用域选工具**。