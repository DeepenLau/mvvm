export class VNode {
  constructor(type, tag, props, exp, text, children) {
    this.type = type
    this.tag = tag
    this.props = props
    this.exp = exp
    this.text = text
    this.children = children
  }
}

export function createElementVNode(tag, props, children) {
  return new VNode(1, tag, props, undefined, undefined, children)
}

export function createTextVNode(text) {
  return new VNode(3, undefined, undefined, undefined, text, undefined)
}

export function renderToDom (vnode) {
  let el = document.createElement(vnode.tag)
  for (let key in vnode.props) {
    setAttr(el, key, vnode.props[key])
  }
  vnode.children.forEach(child => {
    child = (child.type === 1) ? renderToDom(child) : document.createTextNode(child.text)
    el.appendChild(child)
  })
  return el
}

export function setAttr(node, key, value) {
  switch (key) {
    case 'value':
      if (node.tagName,toUpperCase() === 'INPUT' || node.tagName,toUpperCase() === 'TEXTAREA') {
        node.value = value
      } else {
        node.setAttribute(key, value)
      }
      break
    case 'style':
      node.style.cssText = value
      break
    default:
      node.setAttribute(key, value)
      break
  }
}