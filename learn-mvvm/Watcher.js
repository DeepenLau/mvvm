// 观察者是给需要变化的**元素**增加观察者
// 新值和老值进行对比，发生变化就调用更新方法
class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm
    this.expr = expr
    this.cb = cb
    // 先获取老值
    this.value = this.get()
  }
  getVal(vm, expr) {
    expr = expr.split('.') // [a,b,c]
    return expr.reduce((prev, next) => {
      return prev[next]
    }, vm.$data)
  }
  get() {
    Dep.target = this
    let value = this.getVal(this.vm, this.expr)
    Dep.target = null
    return value
  }

  update() {
    let newValue = this.getVal(this.vm, this.expr)
    let oldValue = this.value
    if (newValue != oldValue) {
      this.cb(newValue)
    }
  }
}