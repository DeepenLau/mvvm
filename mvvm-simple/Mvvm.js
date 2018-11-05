import Compile from './Compile.js'
import Observer from './Observer.js'

export default class Mvvm {
  constructor (options) {
    this.$el = options.el
    this.$data = options.data

    // 数据劫持
    new Observer(this.$data)
    // 编译模板
    new Compile(this.$el, this)
  }
}