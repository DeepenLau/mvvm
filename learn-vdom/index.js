import { createElement, render, renderDom } from './element.js'
import diff from './diff.js'
import patch from './patch.js'

let virtualDom1 = createElement('ul', { class: 'list' }, [
  createElement('li', { class: 'item' }, ['a']),
  createElement('li', { class: 'item' }, ['b']),
  createElement('li', { class: 'item' }, ['c'])
])
console.log(virtualDom1)
let virtualDom2 = createElement('ul', { class: 'list-2' }, [
  createElement('li', { class: 'item' }, ['1']),
  // createElement('li', { class: 'item' }, ['b']),
  createElement('li', { class: 'item' }, ['c'])
])

/** bug */
// 如果平级元素互换，会导致重新渲染
// 新增节点，不会被更新

let el = render(virtualDom1)

// 将虚拟dom转化成的真是dom渲染到页面上
renderDom(el, window.root)

setTimeout(() => {
  let patches = diff(virtualDom1, virtualDom2)
  console.log(patches)
  // 给元素打补丁，更新视图
  patch(el, patches)
}, 2000)