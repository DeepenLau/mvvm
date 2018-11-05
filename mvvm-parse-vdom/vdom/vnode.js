import { TEXT_REG } from '../constant.js'

class VNode {
  constructor(type, tag, props, exp, text, children) {
    this.type = type
    this.tag = tag
    this.props = props
    this.attrs = {} // 存放经过编译取值之后的属性，便于 diff 的时候比较
    this.exp = exp
    this.text = text
    this.children = children
  }
}

export function createElementVNode(tag, props, children) {
  return new VNode(1, tag, props, undefined, undefined, children)
}

export function createTextVNode(text) {
  TEXT_REG.lastIndex = 0
  if (TEXT_REG.test(text)) {
    // 含有 {{ }} 表达式的
    let exp = text
    return new VNode(3, undefined, undefined, exp, undefined, undefined)
  }
  return new VNode(3, undefined, undefined, undefined, text, undefined)
}
