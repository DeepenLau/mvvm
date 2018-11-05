
import { TEXT_REG } from './constant.js'
import { getTextValue } from './util.js'
import Watcher from './Watcher.js'

export default class Compile {
  constructor (el, vm) {
    this.el = document.querySelector(el)
    this.vm = vm

    if (this.el) {
      // 1.把节点移入文档片段，在内存中操作
      let fragment = this.node2Fragment(this.el)
      // 2.开始编译
      this.compile(fragment)
      // 3.编译完的文档片段 替换掉原来的 el 节点
      this.el.parentNode.replaceChild(fragment, this.el)
    }
  }

  isElementNode(node) {
    return node.nodeType === 1
  }

  compile (fragment) {
    let childNodes = fragment.childNodes
    // Array.isArray(childNodes) => false，是类数组
    Array.from(childNodes).forEach(childNode => {
      // 判断每个节点的类型
      if (this.isElementNode(childNode)) {
        // 元素节点，编译元素
        this.compileElement(childNode)
        this.compile(childNode)
      } else {
        // 文本节点，编译文本
        this.compileText(childNode)
      }
    })
  }

  compileElement (node) {}

  compileText (node) {
    let expr = node.textContent // 获取文本内容

    if (TEXT_REG.test(expr)) {
      // vue 文档
      // <span v-text="msg"></span>
      // <!-- 和下面的一样 -->
      // <span>{{msg}}</span>
      // v-text 指令
      callDirective('text', node, this.vm, expr)
    }
  }

  node2Fragment (el) {
    let cloneEl = el.cloneNode(true)
    let fragment = document.createDocumentFragment()
    fragment.appendChild(cloneEl)
    return fragment
  }
}

function callDirective(directive, node, vm, expr) {
  util[directive](node, vm, expr)
}

const util = {
  'text' (node, vm, expr) {
    new Watcher(vm, expr, (newValue) => {
      node.textContent = newValue
    })
    node.textContent = getTextValue(vm, expr)
  }
}


