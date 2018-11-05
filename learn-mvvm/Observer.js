class Observer {
  constructor(data) {
    this.observe(data)
  }

  observe(data) {
    // 将原有的 data 数据改成 set 和 get 方法
    if (!data || typeof data !== 'object') {
      return
    }

    // 劫持
    Object.keys(data).forEach(key => {
      this.defineReactive(data, key, data[key])
      this.observe(data[key]) // 深度劫持
    })
  }

  // 定义响应式
  defineReactive(obj, key, value) {
    let that = this
    let dep = new Dep()
    Object.defineProperty(obj, key, {
      enmerable: true,
      configurable: true,
      get() {
        Dep.target && dep.addSub(Dep.target)
        return value
      },
      set(newValue) {
        if (newValue != value) {
          // 这里的 this 不是 vm 实例
          that.observe(newValue)
          value = newValue
          dep.notify() // 通知所有观察者更新
        }
      }
    })
  }
}

class Dep {
  constructor() {
    // 订阅的数组
    this.subs = []
  }
  addSub(watcher) {
    this.subs.push(watcher)
  }
  notify() {
    this.subs.forEach(watcher => {
      watcher.update()
    })
  }
}