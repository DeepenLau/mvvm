import { TEXT_REG } from './constant.js'

export function getValue(vm, expr) {
  expr = expr.split('.') // [a,b,c]
  return expr.reduce((prev, next) => {
    return prev[next]
  }, vm.$data)
}

export function getTextValue(vm, expr) {
  // @see https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/String/replace
  // `{{ foo }} {{ aaa }}` => `bar aa`
  return expr.replace(TEXT_REG, (...args) => {
    return getValue(vm, args[1].trim())
  })
}