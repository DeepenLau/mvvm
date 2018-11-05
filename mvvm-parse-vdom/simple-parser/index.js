import { parseHTML } from './html-parser.js'

/**
 * 这个是要生成 AST 元素节点的函数，返回的是一个对象
 */
export function createASTElement (tag, attrs, parent) {
  return {
    type: 1,
    tag,
    attrsMap: makeAttrsMap(attrs),
    parent,
    children: []
  }
}

export function parse (node) {
  // 存放父级的栈
  const stack = []
  // 最终的 AST
  let root
  // 当前父级
  let currentParent

  parseHTML(node, {
    end() {
      // 用来回退上一个父级
      stack.length -= 1
      currentParent = stack[stack.length - 1]
    },
    compileElement(tag, attrs) { // 遇到元素节点的时候
      let element = createASTElement(tag.toLowerCase(), attrs, currentParent)
      if (!root) {
        root = element
      }

      if (currentParent) {
        currentParent.children.push(element)
        element.parent = currentParent
      }

      currentParent = element
      stack.push(element)
    },

    compileText(text) { // 遇到文本节点的时候
      const children = currentParent.children
      children.push({
        type: 3,
        text
      })
    }
  })

  return root
}

// 把属性类数组转成对象形式
function makeAttrsMap(attrs) {
  let attrsMap = {}
  Array.from(attrs).forEach(attr => {
    attrsMap[attr.name] = attr.value
  })
  return attrsMap
}

