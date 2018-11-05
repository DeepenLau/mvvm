
import { parse } from './parse.js'
import { createVirtualDom, render } from './VDom.js'

export default class Compile {
  constructor (el, vm) {
    this.el = document.querySelector(el)
    this.vm = vm

    if (this.el) {
      // 1.把节点移入文档片段，在内存中操作
      let fragment = this.node2Fragment(this.el)
      // 2.开始编译
      let ast = parse(fragment.firstChild.outerHTML)
      console.log(ast)
      let vdom = createVirtualDom(vm, ast)
      vdom.root = true

      let dom = render(this.vm, vdom)

      // this.compile(fragment)
      // 3.编译完的文档片段 替换掉原来的 el 节点
      this.el.parentNode.replaceChild(dom, this.el)
    }
  }

  node2Fragment (el) {
    let cloneEl = el.cloneNode(true)
    let fragment = document.createDocumentFragment()
    fragment.appendChild(cloneEl)
    return fragment
  }
}
