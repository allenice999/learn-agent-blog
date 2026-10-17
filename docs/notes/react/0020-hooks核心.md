# Hooks 核心

这是 React 的灵魂，也是坑最多的地方。 **useState → useEffect → useRef → useMemo → useCallback** 

## 1 先建立心智模型：Hooks 是什么

Hooks 是**函数组件里"挂"在 React 内部的存储槽**。每次渲染，React 按**调用顺序**把状态一一对应回这些槽。

```jsx
function Comp() {
  const [a] = useState(1);   // 第 1 个槽
  const [b] = useState(2);   // 第 2 个槽
  const ref = useRef(null);  // 第 3 个槽
}
```

**铁律**：
- 只能在**组件顶层**或**自定义 Hook 顶层**调用
- **不能**放在 `if`、`for`、嵌套函数里

```jsx
// ❌ 灾难：条件调用会让槽错位
if (cond) {
  const [x] = useState(0);
}
```

React 靠"第几次调用"来匹配状态，顺序一变，全乱。

## 2 useState

### 基本用法

```jsx
const [count, setCount] = useState(0);
setCount(count + 1);        // 直接传值
setCount(c => c + 1);       // 传函数（推荐，见陷阱1）
```

### 陷阱 1：连续 setState 不叠加

```jsx
// ❌ 只 +1，因为三次读到的 count 都是同一个旧值 0
setCount(count + 1);
setCount(count + 1);
setCount(count + 1);

// ✅ +3，函数式更新拿到的是"最新值"
setCount(c => c + 1);
setCount(c => c + 1);
setCount(c => c + 1);
```

**原理**：state 更新是**批处理**的，同一轮里 `count` 是常量快照。函数式更新让 React 依次把上一个结果喂给下一个。

### 陷阱 2：state 更新是异步的

```jsx
setCount(count + 1);
console.log(count);   // ❌ 还是旧值！
```

`setCount` 只是"登记"了一次更新，真正的重渲染和值变更在**当前事件处理函数跑完之后**。想拿新值，用 `useEffect` 或直接在下次渲染里读。

### 陷阱 3：惰性初始化

渲染函数要纯，所以副作用不能随便放在渲染里——要么用惰性初始化保证只跑一次，要么丢进 `useEffect`

```jsx
// ❌ 每次渲染都执行 expensiveCalc()，浪费
const [v] = useState(expensiveCalc());

// ✅ 只在首次渲染执行一次
const [v] = useState(() => expensiveCalc());
```

> 什么时候真的需要惰性初始化
> - 初始值计算昂贵：大数组排序、复杂解析、读 localStorage
> - 初始值有副作用：读 `localStorage`、访问 `window`
>
> 副作用 = 除了"返回值"之外，还对外部世界做了什么。
>
> 判断标准：这个函数/表达式，除了"算出并返回一个值"之外，还和组件外部的世界发生了交互（读或写），那它就有副作用
> ```js
> localStorage.getItem("theme")   // 读了浏览器外部存储 → 副作用
> fetch("/api/user")              // 发网络请求 → 副作用
> document.title = "x"            // 改了 DOM → 副作用
> window.scrollTo(0, 0)           // 操作浏览器 → 副作用
> console.log("hi")               // 输出到控制台 → 副作用
> Math.random()                   // 结果不确定 → 不算严格纯
> new Date()                      // 依赖外部时间 → 副作用
>```

### 陷阱 4：改对象/数组要造新引用

React判断重新渲染的逻辑是浅比较，如果引用没有变化，那么组件不会重新渲染，界面不会更新

```jsx
setUser({ ...user, name: "x" });              // 改字段
setList([...list, newItem]);                  // 追加
setList(list.filter(i => i.id !== id));       // 删除
setList(list.map(i => i.id === id ? {...i, done: true} : i));  // 改某项
```


## 3 useEffect

### 它是干什么的

让函数组件能"**同步到外部系统**"：请求数据、订阅、操作 DOM、定时器。**不是**用来"监听 state 变化做计算"的（那用渲染时直接算）。

useEffect 的执行时机 = 组件函数执行完 → React 把变化提交到真实 DOM → 浏览器绘制后 → 才执行 effect

React 用的是被动 effect（passive effect），它会等浏览器把画面画出来之后再异步执行 effect。

好处：不阻塞浏览器渲染，用户能更快看到界面。

代价：如果 effect 里要做"测量 DOM 尺寸再调整界面"这类事，可能会看到一帧闪烁（因为界面已经先画了一次）。

> 如果你的副作用需要"在浏览器绘制之前同步执行"（避免闪烁），React 提供了另一个 hook：useLayoutEffect。它的时机是 DOM 更新后、绘制前。日常 99% 的场景用 useEffect 就够了。

### 基本结构

```jsx
useEffect(() => {
  // 副作用：渲染提交到 DOM 之后执行
  const id = setInterval(() => console.log("tick"), 1000);

  return () => {
    // 清理函数：组件卸载前 / 下次 effect 执行前 调用
    clearInterval(id);
  };
}, [依赖数组]);
```

**完整时间线（一次更新）**

```text
1. setState 被调用
2. React 调度更新
3. 【Render 阶段】
   - 重新执行组件函数
   - 生成新虚拟 DOM，diff 出差异
4. 【Commit 阶段】
   - 把差异写入真实 DOM
   - 界面更新
5. 浏览器绘制（paint）
6. 【Effect 阶段】
   - 先执行上一次 effect 的清理函数（cleanup）
   - 再执行本次的 effect
```

**清理函数的时机**

effect 里 return 的函数（cleanup）在两个时机被调用：

1. 组件卸载时：最后一次 cleanup
2. 依赖变化、effect 要重新执行前：先跑旧的 cleanup，再跑新 effect

### 依赖数组的三种形态

```jsx
useEffect(() => {...});          // 不传：每次渲染后都跑（几乎不用）
useEffect(() => {...}, []);      // 空数组：只在挂载后跑一次
useEffect(() => {...}, [a, b]);  // 依赖变化才跑
```

### 🔥 陷阱 1：闭包陷阱（最经典）

```jsx
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      console.log(count);   // ❌ 永远打印 0
    }, 1000);
    return () => clearInterval(id);
  }, []);   // 空依赖 → effect 只跑一次，闭包捕获了首次的 count=0
  // ...
}
```

**为什么**：effect 只在挂载时执行一次，它里面的 `count` 是**第一次渲染时的那份快照**，之后再也不会更新。这就是**闭包陷阱**。

**解法 A**：把 count 加进依赖（但会导致定时器反复重建）

```jsx
useEffect(() => {
  const id = setInterval(() => console.log(count), 1000);
  return () => clearInterval(id);
}, [count]);   // count 变 → 清旧的、建新的
```

**解法 B**：用函数式更新，不依赖外部值

```jsx
useEffect(() => {
  const id = setInterval(() => setCount(c => c + 1), 1000);
  return () => clearInterval(id);
}, []);   // 不再需要 count 依赖
```

**解法 C**：用 `useRef` 存最新值，下面讲`useRef`的时候说明

### 🔥 陷阱 2：依赖是对象/数组 → 无限循环

```jsx
function Comp({ options }) {   // 父组件每次传新对象 {a:1}
  useEffect(() => {
    doSomething(options);
  }, [options]);   // ❌ options 每次渲染都是新引用 → effect 无限跑
}
```

**原因**：`{a:1} !== {a:1}`，引用每次都不同。

**解法**：依赖具体的基本类型字段，或用 `useMemo` 稳定引用。

```jsx
useEffect(() => {
  doSomething(options);
}, [options.a, options.b]);   // ✅ 依赖具体值
```

### 🔥 陷阱 3：该清理的没清理

```jsx
// ❌ 组件卸载后 setState → 警告/内存泄漏
useEffect(() => {
  fetchData().then(data => setData(data));
}, []);

// ✅ 用标志位或 AbortController
useEffect(() => {
  let alive = true;
  fetchData().then(data => { if (alive) setData(data); });
  return () => { alive = false; };
}, []);
```

### 🔥 陷阱 4：用 effect 做本可以渲染时算的事

```jsx
// ❌ 多一次渲染，还容易不同步
const [full, setFull] = useState("");
useEffect(() => {
  setFull(first + last);
}, [first, last]);

// ✅ 派生值直接算
const full = first + last;
```

**原则**：能从 props/state 算出来的，别存 state，别用 effect。

### 依赖数组该写什么（exhaustive-deps 规则）

**把 effect 里用到的、来自组件作用域的所有响应式值都写进去**：props、state、组件内定义的函数/变量。

```jsx
useEffect(() => {
  fetchUser(userId, token);
}, [userId, token]);   // 用到的都写上
```

别为了"只跑一次"而故意漏写依赖——那是在埋闭包陷阱。真需要"只跑一次"，重构代码让它不依赖外部值（如上面解法 B）。


## 4 useRef

### 两个用途

**用途 1：引用 DOM 元素**

```jsx
function Input() {
  const inputRef = useRef(null);

  const focus = () => inputRef.current.focus();

  return <input ref={inputRef} />;
}
```

**用途 2：存"不影响渲染"的可变值**

```jsx
function Timer() {
  const countRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      countRef.current += 1;      // 改它不会触发重渲染
      console.log(countRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, []);
}
```

### useRef vs useState

| | useState | useRef |
|---|---------|--------|
| 改变时重渲染 | ✅ | ❌ |
| 读取时机 | 下次渲染 | 立即（`.current`） |
| 用途 | 要显示的数据 | DOM、定时器 id、最新值快照 |

### 用 useRef 破解闭包陷阱

```jsx
function Timer() {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  useEffect(() => {
    countRef.current = count;   // 每次渲染同步最新值
  }, [count]);

  useEffect(() => {
    const id = setInterval(() => {
      console.log(countRef.current);   // ✅ 永远是最新
    }, 1000);
    return () => clearInterval(id);
  }, []);   // 依赖稳定，不重建
}
```


## 5 useMemo

### 用途：缓存"计算结果的引用"

```jsx
const sorted = useMemo(() => {
  return [...list].sort((a, b) => a - b);
}, [list]);   // list 不变就不重算，且返回同一引用
```

### 它解决两个问题

1. **昂贵计算**：list 很大时避免每次渲染都排序
2. **引用稳定**：返回值引用不变，喂给 `useEffect`/`useCallback`/`React.memo` 子组件时不会误触发

```jsx
const options = useMemo(() => ({ a: 1, b: 2 }), []);
useEffect(() => {
  doSomething(options);
}, [options]);   // ✅ options 引用稳定，不会无限循环
```

### 陷阱：不要滥用

```jsx
// ❌ 过度优化：简单计算 + 有依赖开销，反而更慢
const double = useMemo(() => count * 2, [count]);

// ✅ 直接算
const double = count * 2;
```

**判断标准**：计算真的贵？或者返回值要做其他 hook 的依赖？否则别用。


## 6 useCallback

### 用途：缓存"函数引用"

```jsx
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);   // id 不变，函数引用就不变
```

### 为什么需要它

每次渲染，组件内定义的函数**都是新引用**：

```jsx
function Parent() {
  const [count, setCount] = useState(0);
  const handleClick = () => console.log("click");   // ❌ 每次渲染新函数

  return <Child onClick={handleClick} />;   // Child 每次都收到新 props
}

const Child = React.memo(function Child({ onClick }) {
  console.log("Child 渲染");
  return <button onClick={onClick}>点</button>;
});
```

`React.memo` 做浅比较，`onClick` 每次都是新函数 → **memo 失效，Child 白优化**。

```jsx
// ✅ 用 useCallback 稳定引用
const handleClick = useCallback(() => console.log("click"), []);
```

### useCallback 与闭包陷阱

```jsx
// ❌ 空依赖 → 闭包捕获初始 count
const handle = useCallback(() => {
  console.log(count);
}, []);

// ✅ 要么加依赖
const handle = useCallback(() => {
  console.log(count);
}, [count]);

// ✅ 要么用函数式更新，避免依赖
const handle = useCallback(() => {
  setCount(c => c + 1);
}, []);
```

### 陷阱：滥用 useCallback

如果接收函数的地方**不是** `React.memo` 组件、也**不是** effect 依赖，那 `useCallback` 没有意义，纯增加复杂度。


## 7 三者关系一图流

```
useMemo    → 缓存「值」的引用
useCallback→ 缓存「函数」的引用（本质是 useMemo 的特例）
useRef     → 存「不需要触发渲染」的可变值
```

它们共同的底层机制：**引用比较**。这也是上一轮"改对象属性不更新"的同一个根。


## 🏋️ 练习

**练习 1**：找出 bug

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCount(count + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return <p>{count}</p>;
}
```


答案

闭包陷阱：`count` 永远是 0，所以每秒都是 `setCount(0 + 1) = 1`，count 卡在 1。改成 `setCount(c => c + 1)`。

**练习 2**：为什么无限循环？

```jsx
function Comp({ user }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData(user).then(setData);
  }, [user]);

  return <p>{data}</p>;
}
```

答案

如果父组件每次渲染都传新对象字面量 `<Comp user={{id:1}} />`，`user` 引用每次不同 → effect 每次都跑 → `setData` → 重渲染 → 新 user → 死循环。解法：依赖 `user.id`，或父组件用 `useMemo` 稳定 user。

**练习 3**：用 `useState` + `useEffect` 写一个"待办清单"：
- 输入框添加待办
- 列表显示，每项可删除、可切换完成状态
- 用 `localStorage` 持久化（这就是 effect 同步外部系统的典型场景）


## 核心记忆卡

| Hook | 一句话 | 头号陷阱 |
|------|--------|---------|
| useState | 存会触发渲染的数据 | 连续 set 不叠加；异步 |
| useEffect | 同步到外部系统 | 闭包陷阱；依赖引用不稳 |
| useRef | 存不触发渲染的值/DOM | 改它不会重渲染 |
| useMemo | 缓存值的引用 | 滥用反而更慢 |
| useCallback | 缓存函数的引用 | 滥用；闭包陷阱 |


**消化一下，做练习 3（待办清单）最有价值，它把这几个 hook 全串起来了。**
