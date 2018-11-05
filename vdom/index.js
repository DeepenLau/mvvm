import { createElementVNode, createTextVNode, renderToDom } from './vnode.js'
import diff from './diff.js'
import { patch } from './patch.js'

let virtualDom1 = createElementVNode('ul', { class: 'list' }, [
  createElementVNode('li', { class: 'item' }, [createTextVNode('a')]),
  createElementVNode('li', { class: 'item' }, [createTextVNode('b')]),
  createElementVNode('li', { class: 'item' }, [createTextVNode('c')])
])


let dom = renderToDom(virtualDom1)

document.getElementById('root').appendChild(dom)
let virtualDom2
setTimeout(() => {
  virtualDom2 = createElementVNode('ul', { class: 'new-list' }, [
    createElementVNode('li', { class: 'item' }, [createTextVNode('new a')]),
    createElementVNode('li', { class: 'item' }, [createTextVNode('b')]),
    createElementVNode('li', { class: 'item' }, [createTextVNode('c')])
  ])

  let patches = diff(virtualDom1, virtualDom2)

  patch(dom, patches)
}, 2000)
setTimeout(() => {
  let virtualDom3 = createElementVNode('ul', { class: 'new-list' }, [
    createElementVNode('li', { class: 'item' }, [createTextVNode('new a')]),
    createElementVNode('li', { class: 'item' }, [createTextVNode('b冲冲冲')]),
    createElementVNode('li', { class: 'item' }, [createTextVNode('c')])
  ])

  let patches = diff(virtualDom2, virtualDom3)

  patch(dom, patches)
}, 3000)