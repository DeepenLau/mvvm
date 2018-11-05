import { getTextValue, getValue } from '../util.js'
import { bindRE } from '../constant.js'
import Watcher from '../Watcher.js'
import diff from './diff.js'
import patch from './patch.js'

let oldRootVnode
let newRootVnode
let rootEl

export function renderToDom (vm, vnode) {
  if (!newRootVnode) {
    newRootVnode = vnode
  }

  let el = document.createElement(vnode.tag)
  if (!rootEl) {
    rootEl = el
  }
  for (let key in vnode.props) {

    let bindKey = key.match(bindRE)
    if (bindKey) {
      // 匹配属性上有绑定的值，正则是匹配 : 或者 v-bind
      let domKey = key.split(bindKey[0])[1]
      setAttr(el, domKey, getValue(vm, vnode.props[key]), vnode)
      new Watcher(vm, vnode.props[key], (newValue, isDone) => {
        if (isDone) {
          doDiff(oldRootVnode, newRootVnode)
        }
      })
    } else {
      setAttr(el, key, vnode.props[key], vnode)
    }
  }

  vnode.children.forEach(childVnode => {
    let child
    if (childVnode.type === 1) {
      // 元素节点继续递归
      child = renderToDom(vm, childVnode)
    } else if (childVnode.exp) {
      // 文本节点带有表达式，去取值并创建文本节点，更新 vnode 的 text 值
      const text = getTextValue(vm, childVnode.exp)
      child = document.createTextNode(text)
      childVnode.text = text
      new Watcher(vm, childVnode.exp, (newValue, isDone) => {
        childVnode.text = newValue
        if (isDone) {
          doDiff(oldRootVnode, newRootVnode)
        }
      })
    } else {
      // 普通文本节点
      child = document.createTextNode(childVnode.text)
    }
    el.appendChild(child)
  })
  // 简单的深拷贝一个旧的 vdom
  oldRootVnode = JSON.parse(JSON.stringify(vnode))
  return el
}

export function setAttr(node, key, value, vnode) {
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
  vnode.attrs[key] = value
}

function doDiff(oldRootVnode, newRootVnode) {
  const patches = diff(oldRootVnode, newRootVnode)
  patch(rootEl, patches)
}