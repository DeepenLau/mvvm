class MVVM {
  constructor (options) {
    // 先把可用的东西挂载在实例上
    this.$el = options.el
    this.$data = options.data

    // 有模板就开始编译
    if (this.$el) {
      // 数据数据
      new Observer(this.$data)
      this.proxyData(this.$data)
      // 用数据和元素进行编译
      new Compile(this.$el, this)
    }
  }

  proxyData(data) {
    Object.keys(data).forEach(key => {
      Object.defineProperty(this, key, {
        get() {
          return data[key]
        },
        set(newValue) {
          data[key] = newValue
        }
      })
    })
  }
}