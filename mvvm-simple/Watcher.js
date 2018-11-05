import { getTextValue } from './util.js'
import { Dep } from './Observer.js'

// 观察者是给需要变化的**元素**增加观察者
// 新值和老值进行对比，发生变化就调用更新方法
// 在模板编译的时候调用
export default class Watcher {
  constructor (vm, expr, cb) {
    this.vm = vm
    this.expr = expr // 表达式 {{ foo }}
    this.cb = cb // 给外面用的回调函数

    // 先获取老值
    // this.get() 里面的 getTextValue 方法对 vm.$data 的属性获取了值
    // 所以触发了 响应的该属性的 get 方法
    // 也就是走了一次 Observer.js 里面的 Object.defineProperty 劫持的该属性的 getter
    // 也是在这个时候，把当前 watcher 实例放入到订阅数组中，以便在更新数据的时候调用到该实例的 update 方法
    // 至于怎么在 getter 中获取到当前 watcher 实例，看下面的 this.get()
    this.value = this.get()
  }

  get () {
    // Dep.target = this 的作用在于
    // 暂存当前 watcher 实例，然后下面取值之后会触发 getter
    // 在 getter 里面获取 Dep.target，也就获取到了当前的 watcher 实例
    // 然后把当前实例放到订阅者数组中
    Dep.target = this // 相当于一个全局属性做 当前 watcher 实例的跳板
    let value = getTextValue(this.vm, this.expr) // 这个方法里面会触发 getter
    // 为了确保每个属性有自己独立的 Watcher ，需要把上一个 this 解绑
    Dep.target = null
    return value
  }

  update () {
    // 值已经改变之后，还没有更新到 dom
    let newValue = getTextValue(this.vm, this.expr)
    let oldValue = this.value
    if (newValue != oldValue) {
      this.cb(newValue) // 调用 watcher 的 callback
    }
  }
}