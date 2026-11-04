## 1. A绝对定位在左上角，B相对定位，AB是兄弟元素，宽高相同，A在前，B在后，二者是否会重合

会重合。

A 绝对定位脱离文档流，B 相对定位仍占据原文档流位置；B 会在 A 的上方。标准绘制顺序中，同为定位元素且 z-index:auto 时，DOM 靠后的元素绘制在上方

## 2. 深拷贝和浅拷贝

浅拷贝只复制第一层，嵌套引用类型仍共享内存；深拷贝递归复制所有层级，新旧对象完全独立。

- 浅拷贝：`Object.assign`、展开运算符 `...`、`slice`
- 深拷贝：`structuredClone()`、`JSON.parse(JSON.stringify())`、`lodash.cloneDeep`

### 实现深拷贝需要注意哪些点

判断被拷贝的元素是否是基本类型，如果是基本类型就直接返回

判断被拷贝元素是对象还是数组，定义result变量用于输出拷贝结果

遍历被拷贝元素，将被拷贝元素的属性和值赋值到result变量上

```js
function deepclone (target, map = new WeakMap()) {
  if (typeof target !== 'object' || target === null) return target;
  if (map.has(target)) return map.get(target);
  const result = Array.isArray(target) ? [] : {}
  map.set(target, result)
  for (let key in target) {
    if (target.hasOwnProperty(key)) {
      result[key] = deepclone(target[key], map)
    }
  }
  return result
}
```

解决循环引用可以使用WeakMap缓存已经拷贝过的对象


