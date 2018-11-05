import { TEXT_REG } from './constant.js'
import { parseFilters } from './filter-parser.js'

export function getTextValue(vm, expr) {
  // @see https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/String/replace
  // `{{ foo }} {{ aaa }}` => `bar aa`
  return expr.replace(TEXT_REG, (...args) => {
    let key = args[1].trim()
    return vm.$data[key]
  })
}

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 */
export function makeMap (str, expectsLowerCase) {
  const map = Object.create(null)
  const list = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase
    ? val => map[val.toLowerCase()]
    : val => map[val]
}

export const isUnaryTag = makeMap(
  'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
  'link,meta,param,source,track,wbr'
)

// Elements that you can, intentionally, leave open
// (and which close themselves)
export const canBeLeftOpenTag = makeMap(
  'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
);

/**
 * Always return false.
 */
export const no = (a, b, c) => false

// check whether current browser encodes a char inside attribute values
let div
function getShouldDecode (href) {
  div = div || document.createElement('div')
  div.innerHTML = href ? `<a href="\n"/>` : `<div a="\n"/>`
  return div.innerHTML.indexOf('&#10;') > 0
}

// http://hcysun.me/vue-design/appendix/web-util.html#compat-js-%E6%96%87%E4%BB%B6
// 解析 换行符或制表符 '\n'
// #3663: IE encodes newlines inside attribute values while other browsers don't
export const shouldDecodeNewlines = getShouldDecode(false)
// #6828: chrome encodes content in a[href]
export const shouldDecodeNewlinesForHref = getShouldDecode(true)

// HTML5 tags https://html.spec.whatwg.org/multipage/indices.html#elements-3
// Phrasing Content https://html.spec.whatwg.org/multipage/dom.html#phrasing-content
export const isNonPhrasingTag = makeMap(
  'address,article,aside,base,blockquote,body,caption,col,colgroup,dd,' +
  'details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,' +
  'h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,' +
  'optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,' +
  'title,tr,track'
)

/**
 * Create a cached version of a pure function.
 */
export function cached (fn) {
  const cache = Object.create(null)
  return (function cachedFn (str) {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  })
}

export function pluckModuleFunction (modules, key) {
  return modules
    ? modules.map(m => m[key]).filter(_ => _)
    : []
}

var inBrowser = typeof window !== 'undefined';
var UA = inBrowser && window.navigator.userAgent.toLowerCase();
export const isIE = UA && /msie|trident/.test(UA)
export const isServerRendering = false

// note: this only removes the attr from the Array (attrsList) so that it
// doesn't get processed by processAttrs.
// By default it does NOT remove it from the map (attrsMap) because the map is
// needed during codegen.
export function getAndRemoveAttr (el, name, removeFromMap) {
  let val
  if ((val = el.attrsMap[name]) != null) {
    const list = el.attrsList
    for (let i = 0, l = list.length; i < l; i++) {
      if (list[i].name === name) {
        list.splice(i, 1)
        break
      }
    }
  }
  if (removeFromMap) {
    delete el.attrsMap[name]
  }
  return val
}

export function getBindingAttr (el, name, getStatic) {
  const dynamicValue =
    getAndRemoveAttr(el, ':' + name) ||
    getAndRemoveAttr(el, 'v-bind:' + name)
  // 只有当绑定属性本身就不存在时，此时获取到的属性值为 undefined，与 null 相等，这时才会执行 elseif 分支的判断
  // undefined == null --> true
  // undefined === null --> false
  if (dynamicValue != null) { // 判断绑定的属性是否存在，而非判断属性值 dynamicValue 是否存在
    return parseFilters(dynamicValue)
  } else if (getStatic !== false) {
    // getStatic !== false
    // 这里的关键是一定要不全等才行
    // 调用 getBindingAttr 函数时不传递第三个参数 getStatic 的值为 undefined，它不全等于 false
    // 所以可以理解为当不传递第三个参数时 elseif 分支的条件默认成立
    // 当获取绑定的属性失败时，我们不能够武断的认为开发者没有编写该属性，而是应该继续尝试获取非绑定的属性值
    const staticValue = getAndRemoveAttr(el, name)
    if (staticValue != null) {
      // 使用 JSON.stringify 函数处理其属性值的原因，目的就是确保将非绑定的属性值作为字符串处理，而不是变量或表达式。
      return JSON.stringify(staticValue)
    }
  }
}

/**
 * Mix properties into target object.
 */
export function extend (to, _from) {
  for (const key in _from) {
    to[key] = _from[key]
  }
  return to
}

export function addAttr (el, name, value) {
  (el.attrs || (el.attrs = [])).push({ name, value })
  el.plain = false
}

export function addProp (el, name, value) {
  (el.props || (el.props = [])).push({ name, value })
  el.plain = false
}

export function addDirective (el, name, rawName, value, arg, modifiers) {
  (el.directives || (el.directives = [])).push({ name, rawName, value, arg, modifiers })
  el.plain = false
}

/**
 * Camelize a hyphen-delimited string.
 */
const camelizeRE = /-(\w)/g
export const camelize = cached((str) => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
})

/**
 *
 * @param {*} el        当前元素描述对象
 * @param {*} name      绑定属性的名字，即事件名称
 * @param {*} value     绑定属性的值，这个值有可能是事件回调函数名字，有可能是内联语句，有可能是函数表达式
 * @param {*} modifiers 指令对象
 * @param {*} important 可选参数，是一个布尔值，代表着添加的事件侦听函数的重要级别，如果为 true，则该侦听函数会被添加到该事件侦听函数数组的头部，否则会将其添加到尾部，
 * @param {*} warn      打印警告信息的函数，是一个可选参数
 */
export function addHandler (el, name, value, modifiers, important, warn) {
  modifiers = modifiers || emptyObject
  // warn prevent and passive modifier
  // 提示开发者 passive 修饰符不能和 prevent 修饰符一起使用
  // 这是因为在事件监听中 passive 选项参数就是用来告诉浏览器该事件监听函数是不会阻止默认行为的
  if (modifiers.prevent && modifiers.passive) {
    console.log(
      'passive and prevent can\'t be used together. ' +
      'Passive handler can\'t prevent default event.'
    )
  }

  // check capture modifier
  if (modifiers.capture) {
    delete modifiers.capture
    name = '!' + name // mark the event as captured
  }
  if (modifiers.once) {
    delete modifiers.once
    name = '~' + name // mark the event as once
  }
  if (modifiers.passive) {
    delete modifiers.passive
    name = '&' + name // mark the event as passive
  }

  // 鼠标本没有滚轮点击事件，一般我们区分用户点击的按钮是不是滚轮的方式是监听 mouseup 事件，
  // 然后通过事件对象的 event.button 属性值来判断，如果 event.button === 1 则说明用户点击的是滚轮按钮。
  if (name === 'click') {
    if (modifiers.right) {
      // .right 重写为 contextmenu 事件
      name = 'contextmenu'
      delete modifiers.right
    } else if (modifiers.middle) {
      name = 'mouseup'
    }
  }

  let events
  if (modifiers.native) {
    delete modifiers.native
    events = el.nativeEvents || (el.nativeEvents = {})
  } else {
    events = el.events || (el.events = {})
  }

  const newHandler = {
    // 该属性的值就是 v-on 指令的属性值
    value: value.trim()
  }
  if (modifiers !== emptyObject) {
    newHandler.modifiers = modifiers
  }

  // 多个相同事件名，el.events 会变成数组,单个是对象
  // eg. <div @click.prevent="handleClick1" @click="handleClick2"></div>
  /**
   * el.events = {
      click: [
        {
          value: 'handleClick1',
          modifiers: { prevent: true }
        },
        {
          value: 'handleClick2'
        }
      ]
    }
   */
  // 无论你有多少个同名事件的监听，都不会落下任何一个监听函数的执行。
  const handlers = events[name]
  if (Array.isArray(handlers)) {
    important ? handlers.unshift(newHandler) : handlers.push(newHandler)
  } else if (handlers) {
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
  } else {
    events[name] = newHandler
  }

  el.plain = false
}

/**
 * Cross-platform codegen helper for generating v-model value assignment code.
 */
export function genAssignmentCode (value, assignment) {
  const res = parseModel(value)
  if (res.key === null) {
    return `${value}=${assignment}`
  } else {
    return `$set(${res.exp}, ${res.key}, ${assignment})`
  }
}

export function parseModel (val) {
  // Fix https://github.com/vuejs/vue/pull/7730
  // allow v-model="obj.val " (trailing whitespace)
  val = val.trim()
  len = val.length

  if (val.indexOf('[') < 0 || val.lastIndexOf(']') < len - 1) {
    index = val.lastIndexOf('.')
    if (index > -1) {
      return {
        exp: val.slice(0, index),
        key: '"' + val.slice(index + 1) + '"'
      }
    } else {
      return {
        exp: val,
        key: null
      }
    }
  }

  str = val
  index = expressionPos = expressionEndPos = 0

  while (!eof()) {
    chr = next()
    /* istanbul ignore if */
    if (isStringStart(chr)) {
      parseString(chr)
    } else if (chr === 0x5B) {
      parseBracket(chr)
    }
  }

  return {
    exp: val.slice(0, expressionPos),
    key: val.slice(expressionPos + 1, expressionEndPos)
  }
}

function eof () {
  return index >= len
}

function next () {
  return str.charCodeAt(++index)
}

function isStringStart (chr) {
  return chr === 0x22 || chr === 0x27
}

function parseString (chr) {
  const stringQuote = chr
  while (!eof()) {
    chr = next()
    if (chr === stringQuote) {
      break
    }
  }
}

function parseBracket (chr) {
  let inBracket = 1
  expressionPos = index
  while (!eof()) {
    chr = next()
    if (isStringStart(chr)) {
      parseString(chr)
      continue
    }
    if (chr === 0x5B) inBracket++
    if (chr === 0x5D) inBracket--
    if (inBracket === 0) {
      expressionEndPos = index
      break
    }
  }
}

// add a raw attr (use this in preTransforms)
export function addRawAttr (el, name, value) {
  el.attrsMap[name] = value
  el.attrsList.push({ name, value })
}

export const parseStyleText = cached(function (cssText) {
  // eg. <div style="color: red; background: green;"></div>
  const res = {}
  const listDelimiter = /;(?![^(]*\))/g // 去除匹配 <div style="color: red; background: url(www.xxx.com?a=1&amp;copy=3);"></div> 这种 url() 中的 ; 符号
  const propertyDelimiter = /:(.+)/
  cssText.split(listDelimiter).forEach(function (item) {
    if (item) {
      var tmp = item.split(propertyDelimiter)
      tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim())
    }
  })
  /**
   *  res = {
        color: 'red',
        background: 'green'
      }
   */
  return res
})