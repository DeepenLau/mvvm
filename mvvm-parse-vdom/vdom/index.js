import { createElementVNode, createTextVNode } from './vnode.js'

export function createVirtualDom (vm, ast) {
  let root
  let vnode = createElementVNode(ast.tag, { ...ast.attrsMap }, [])
  if (!ast.parent) {
    root = vnode
  }

  if (ast.children && ast.children.length) {
    createChildVNode(vm, ast.children, vnode)
  }
  return root
}

function createChildVNode (vm, astChildren, parentVnode) {
  astChildren.forEach(astChild => {
    let vnode
    if (astChild.type === 1) {
      vnode = createElementVNode(astChild.tag, { ...astChild.attrsMap }, [])
    } else {
      vnode = createTextVNode(astChild.text)
    }

    parentVnode.children.push(vnode)

    if (astChild.children && astChild.children.length) {
      // 有子节点就递归
      createChildVNode(vm, astChild.children, vnode)
    }
  })
}