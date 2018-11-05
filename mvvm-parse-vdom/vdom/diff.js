// 补丁包的几个类型
const ATTRS = 'ATTRS'     // 属性改了
const TEXT = 'TEXT'       // 文本改了
const REMOVE = 'REMOVE'   // 节点删除了
const REPLACE = 'REPLACE' // 节点替换了
let Index = 0 // 全局的 index，避免子节点递归遍历的顺序混乱

export default function diff (oldVnode, newVnode) {
  Index = 0 // 每次diff都复位这个全局的 Index
  let patches = {}
  let index = 0
  // 递归树，比较后的结果放到补丁包中
  walk(oldVnode, newVnode, index, patches)
  return patches
}


function walk(oldNode, newNode, index, patches) {
  let currentPatch = []
  if (!newNode) {
    // 删除节点了
    currentPatch.push({ type: REMOVE, index })
  } else if (isString(oldNode.text) && isString(newNode.text)) {
    // 字符串节点
    if (oldNode.text !== newNode.text) {
      // 不一样
      currentPatch.push({ type: TEXT, text: newNode.text })
    }
  } else if (oldNode.type === newNode.type) { // 节点类型相同
    // 比较属性是否有更改
    let attrs = diffAttr(oldNode.attrs, newNode.attrs)
    // 有更改再往 currentPatch 里面放
    if (Object.keys(attrs).length > 0) {
      currentPatch.push({ type: ATTRS, attrs })
    }
    // 有子节点遍历子节点
    diffChildren(oldNode.children, newNode.children, patches)
  } else {
    // 说明节点被替换
    currentPatch.push({ type: REPLACE, newNode })
  }
  if (currentPatch.length > 0) { // 有补丁再放
    // 放入大补丁包
    patches[index] = currentPatch
  }
}

function diffAttr(oldAttrs, newAttrs) {
  let patch = {}
  // 判断老属性
  for (let key in oldAttrs) {
    if (oldAttrs[key] !== newAttrs[key]) {
      patch[key] = newAttrs[key] // 有可能 undefined（新节点中删除了旧节点的属性）
    }
  }
  // 新增属性
  for (let key in newAttrs) {
    // 老节点没有新节点的属性，说明是新增的
    if (!oldAttrs.hasOwnProperty(key)) {
      patch[key] = newAttrs[key]
    }
  }
  return patch
}

function isString(node) {
  return Object.prototype.toString.call(node) == '[object String]'
}

function diffChildren(oldChildren, newChildren, patches) {
  oldChildren.forEach((child, idx) => {
    // index 每次递增，应该基于一个全局的序号来遍历
    walk(child, newChildren[idx], ++Index, patches)
  })
}
