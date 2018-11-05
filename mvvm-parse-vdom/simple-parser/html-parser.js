export function parseHTML (node, options) {
  // 目前只简单处理元素节点和文本节点
  // https://developer.mozilla.org/zh-CN/docs/Web/API/Node/nodeType
  switch (node.nodeType) {
    case 1:
      options.compileElement(node.tagName.toLowerCase(), node.attributes, false)

      let childNodes = Array.from(node.childNodes)

      if (!childNodes.length) { // 子节点列表数组为空直接回退上一级父节点
        options.end()
      }

      childNodes.forEach((child, index) => {
        parseHTML(child, options)
        if (childNodes.length - 1 === index) {
          // 子节点个数遍历到最后一个调用 end 方法去回退 currentParent
          options.end()
        }
      })
      break
    case 3:
      options.compileText(node.textContent)
      break
    default:
      break
  }
}