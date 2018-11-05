import {
  getAndRemoveAttr,
  getBindingAttr
} from '../util.js'

function transformNode (el, options) {
  // const warn = options.warn || baseWarn
  const staticClass = getAndRemoveAttr(el, 'class')
  if (staticClass) { // 非生产环境下提示
    const res = parseText(staticClass, options.delimiters)
    // 如果解析成功则说明你在非绑定的 class 属性中使用了字面量表达式
    // 然后警告
    if (res) {
      console.log(
        `class="${staticClass}": ` +
        'Interpolation inside attributes has been removed. ' +
        'Use v-bind or the colon shorthand instead. For example, ' +
        'instead of <div class="{{ val }}">, use <div :class="val">.'
      )
    }
  }
  if (staticClass) {
    // 非绑定的 class 放入 staticClass
    el.staticClass = JSON.stringify(staticClass)
  }
  const classBinding = getBindingAttr(el, 'class', false /* getStatic */)
  if (classBinding) {
    // 绑定的 class 放入 classBinding
    el.classBinding = classBinding
  }
}

export default {
  staticKeys: ['staticClass'],
  transformNode,
  genData
}