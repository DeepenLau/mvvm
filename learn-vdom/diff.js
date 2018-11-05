const ATTRS = 'ATTRS'
const TEXT = 'TEXT'
const REMOVE = 'REMOVE'
const REPLACE = 'REPLACE'
let Index = 0

function diff (oldTree, newTree) {
  let patches = {}
  let index = 0
  // 递归树，比较后的结果放到补丁包中
  walk(oldTree, newTree, index, patches)
  return patches
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

function walk(oldNode, newNode, index, patches) {
  let currentPatch = []
  if (!newNode) {
    // 删除节点了
    currentPatch.push({ type: REMOVE, index })
  } else if (isString(oldNode) && isString(newNode)) {
    // 字符串节点
    if (oldNode !== newNode) {
      // 不一样
      currentPatch.push({ type: TEXT, text: newNode })
    }
  } else if (oldNode.type === newNode.type) { // 节点类型相同
    // 比较属性是否有更改
    let attrs = diffAttr(oldNode.props, newNode.props)
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

export default diff