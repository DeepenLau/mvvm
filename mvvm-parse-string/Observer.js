export default class Observer {
  constructor (data) {
    this.observe(data)
  }

  observe (data) {
    if (!data || typeof data !== 'object') return
    Object.keys(data).forEach(key => {
      this.defineReactive(data, key, data[key])
      this.observe(data[key])
    })
  }

  defineReactive (data, key, value) {
    const dep = new Dep()
    Object.defineProperty(data, key, {
      enmerable: true,
      configurable: true,
      get () {
        // Dep.target 就是 watcher 实例
        // 当数据异步更新变化的时候，Dep.target 为 null，不需要在添加 watcher 实例作为订阅者
        Dep.target && dep.addSub(Dep.target)
        return value
      },
      set (newValue) {
        if (value === newValue) return
        value = newValue
        dep.notify()
      }
    })
  }
}

/**
 * 发布订阅
 * 用来收集订阅者，数据变动触发notify，再调用订阅者的update方法
 */
export class Dep {
  constructor () {
    // 订阅者的数组
    this.subs = []
  }

  addSub (watcher) {
    // 添加订阅者
    this.subs.push(watcher)
  }

  notify () {
    this.subs.forEach(watcher => watcher.update() )
  }
}