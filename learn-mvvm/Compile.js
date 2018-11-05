class Compile {
  constructor(el, vm) {
    this.el = this.isElementNode(el) ? el : document.querySelector(el)
    this.vm = vm

    if (this.el) {
      // 如果这个元素能获取到，我们才开始编译
      // 1.先把这些真实的DOM移入到内存中 fragment
      let fragment = this.node2fragment(this.el)
      // 2.编译 => 提取想要的元素节点 v-model 和文本节点 {{}}
      this.compile(fragment)
      // 3.把编译好的fragment再塞回去页面里去
      this.el.appendChild(fragment)
    }
  }

  // 辅助方法
  isElementNode(node) {
    return node.nodeType === 1
  }

  isDirective(name) {
    return name.includes('v-')
  }

  // 核心方法
  compileElement(node) {
    let attrs = node.attributes // 获取元素属性
    Array.from(attrs).forEach(attr => {
      let attrName = attr.name
      if(this.isDirective(attrName)) { // 如果是指令属性
        // 把对应的值放到节点中
        let expr = attr.value
        let [, type] = attrName.split('-')
        // node this.vm.$data expr
        CompileUtil[type](node, this.vm, expr)
      }
    })
  }
  compileText(node) {
    // 带 {{}}
    let expr = node.textContent // 获取文本内容
    let reg = /\{\{([^}]+)\}\}/g

    if (reg.test(expr)) {
      // node this.vm.$data expr
      CompileUtil['text'](node, this.vm, expr)
    }
  }

  compile(fragment) {
    // 递归
    let childNodes = fragment.childNodes
    Array.from(childNodes).forEach(node => {
      if (this.isElementNode(node)) {
        // 元素节点，递归
        // 编译元素
        this.compileElement(node)
        this.compile(node)
      } else {
        // 文本节点
        this.compileText(node)
      }
    })
  }


  node2fragment(el) {
    // 把el中的内容全部放入内存
    let fragment = document.createDocumentFragment(el)
    let firstChild
    while ((firstChild = el.firstChild)) {
      fragment.appendChild(firstChild)
    }
    return fragment
  }
}


CompileUtil = {
  getVal(vm, expr) {
    expr = expr.split('.') // [a,b,c]
    return expr.reduce((prev, next) => {
      return prev[next]
    }, vm.$data)
  },
  getTextVal(vm, expr) {
    return expr.replace(/\{\{([^}]+)\}\}/g, (...arguments) => {
      return this.getVal(vm, arguments[1])
    })
  },
  text(node, vm, expr) { // 文本处理
    // {{message.a.b.c}}
    let updaterFn = this.updater['textUpdater']
    let value = this.getTextVal(vm, expr)
    expr.replace(/\{\{([^}]+)\}\}/g, (...arguments) => {
      new Watcher(vm, arguments[1], (newValue) => {
        // 如果数据变化了，文本节点需要重新获取依赖的数据
        updaterFn && updaterFn(node, this.getTextVal(vm, expr))
      })
    })
    updaterFn && updaterFn(node, value)
  },
  setVal(vm, expr, value) {
    expr = expr.split('.')
    return expr.reduce((prev, next, currentIndex) => {
      if (currentIndex == expr.length - 1) {
        return prev[next] = value
      }
      return prev[next]
    }, vm.$data)
  },
  model(node, vm, expr) { // 输入框处理
    let updaterFn = this.updater['modelUpdater']
    // v-model="message.a.b.c"
    // 这里加一个监控 数据变化后，应该调用这个 watcher 的 callback
    new Watcher(vm, expr, (newValue) => {
      // 当值变化后会调用cb 将新的值传递进来
      updaterFn && updaterFn(node, this.getVal(vm, expr))
    })
    node.addEventListener('input', (e) => {
      let newValue = e.target.value
      this.setVal(vm, expr, newValue)
    })
    updaterFn && updaterFn(node, this.getVal(vm, expr))
  },
  updater: {
    textUpdater(node, value) {
      node.textContent = value
    },
    modelUpdater(node, value) {
      node.value = value
    }
  }
}