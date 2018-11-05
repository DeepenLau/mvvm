import {
  getAndRemoveAttr,
  getBindingAttr,
  parseStyleText
} from '../util.js'

function transformNode (el, options) {
  // const warn = options.warn || baseWarn
  const staticStyle = getAndRemoveAttr(el, 'style')
  if (staticStyle) {
    if (true) { // 非生产环境下提示
      const res = parseText(staticStyle, options.delimiters)
      // 静态属性里面使用了绑定的值
      if (res) {
        console.log(
          `style="${staticStyle}": ` +
          'Interpolation inside attributes has been removed. ' +
          'Use v-bind or the colon shorthand instead. For example, ' +
          'instead of <div style="{{ val }}">, use <div :style="val">.'
        )
      }
    }
    el.staticStyle = JSON.stringify(parseStyleText(staticStyle))
  }

  const styleBinding = getBindingAttr(el, 'style', false /* getStatic */)
  if (styleBinding) {
    el.styleBinding = styleBinding
  }
}

export default {
  staticKeys: ['staticStyle'],
  transformNode,
  genData
}