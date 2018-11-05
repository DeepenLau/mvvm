import { createElementVNode, createTextVNode, VNode } from './vnode/vnode.js'
import { getTextValue } from './util.js';
import { bindRE } from './parse.js'
import Watcher from './Watcher.js'
import { diff } from './vnode/diff.js'
import { patch } from './vnode/patch.js'

let root

export function createVirtualDom (vm, ast) {
  let VNode = createElementVNode(ast.type, ast.tag, { ...ast.attrsMap }, undefined, [])
  if (!ast.parent) {
    root = VNode
  }

  if (ast.children && ast.children.length) {
    createChildVNode(vm, ast.children, VNode)
  }
  return root
}

function createChildVNode (vm, astChildren, parentVNode) {
  astChildren.forEach(astChild => {
    let VNode
    if (astChild.type === 1) {
      VNode = createElementVNode(astChild.type, astChild.tag, { ...astChild.attrsMap }, undefined, [])
    } else if (astChild.type === 2) {
      VNode = createTextVNode(astChild.type, astChild.text)
    } else if (astChild.type === 3) {
      VNode = createTextVNode(astChild.type, astChild.text)
    }

    parentVNode.children && parentVNode.children.push(VNode)

    if (astChild.children && astChild.children.length) {
      createChildVNode(vm, astChild.children, VNode)
    }
  })
}

function setAttr(node, key, value) {
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

function getValue (vm, key) {
  return vm.$data[key]
}

let rootVnode
let newRootVnode
let rootEl
let timer
export function render (vm, vnode) {
  if (vnode.root) {
    newRootVnode = vnode
  }
  let el
  if (vnode.type === 1) { // 元素节点
    el = document.createElement(vnode.tag)
    if (vnode.root) {
      rootEl = el
    }
    for (let key in vnode.props) {
      let bindKey = key.match(bindRE)
      if (bindKey) {
        setAttr(el, key.split(bindKey[0])[1], getValue(vm, vnode.props[key]))
      } else {
        setAttr(el, key, vnode.props[key])
      }
    }

    vnode.children.forEach(childVnode => {
      let child = (vnode.type === 1) ? render(vm, childVnode) : document.createTextNode(childVnode)
      el.appendChild(child)
    })
  } else { // 文本节点（包括有表达式）
    const value = getTextValue(vm, vnode.exp)
    el = document.createTextNode(value)
    vnode.text = value

    new Watcher(vm, vnode.exp, (newValue) => {
      vnode.text = newValue

      if (timer) return
      timer = setTimeout(() => {
        const patches = diff(rootVnode, newRootVnode)
        patch(rootEl, patches)
        timer = null
      })
    })
  }
  rootVnode = JSON.parse(JSON.stringify(vnode))
  return el

}