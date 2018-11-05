let allPatches
let index = 0

export function patch(node, patches) {
  index = 0
  allPatches = patches
  walk(node)
}

function walk(node) {
  let currentPatch = allPatches[index++]
  let childNodes = node.childNodes
  // 深度优先遍历子节点，遍历完了再走下面
  childNodes.forEach(child => walk(child))
  // 顺序从最深的节点开始打补丁，index 最大的那个开始
  if (currentPatch) {
    doPatch(node, currentPatch)
  }
}

function doPatch(node, patches) {
  patches.forEach(patch => {
    switch (patch.type) {
      case 'ATTRS':
        for (let key in patch.attrs) {
          let value = patch.attrs[key]
          if (value) {
            setAttr(node, key, value)
          } else {
            node.removeAttribute(key)
          }
        }
        break;
      case 'TEXT':
        node.textContent = patch.text
        break
      case 'REMOVE':
        node.parentNode.removeChild(node)
        break
      case 'REPLACE':
        // patch.newNode 可能是虚拟 dom，如果是，则用 render 转成真实 dom，否则就是文本节点，最后替换到真实 dom
        let vNode = patch.newNode
        let newNode = (vNode instanceof Element) ? render(vNode) : document.createTextNode(vNode)
        node.parentNode.replaceChild(newNode, node)
        break

      default:
        break;
    }
  })
}