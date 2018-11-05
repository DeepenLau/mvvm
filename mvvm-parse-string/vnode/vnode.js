export class VNode {
  constructor(type, tag, props, exp, children) {
    this.type = type
    this.tag = tag
    this.props = props
    this.exp = exp
    this.children = children
  }
}

export function createElementVNode(type, tag, props, exp, children) {
  return new VNode(type, tag, props, exp, children)
}

export function createTextVNode(type, exp) {
  return new VNode(type, undefined, undefined, exp)
}

// function renderDom(el, target) {
//   target.appendChild(el)
// }
