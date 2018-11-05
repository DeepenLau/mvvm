import he from './third-part/he.js'
import { parseHTML } from './html-parser.js'
import { parseText } from './text-parser.js'
import { parseFilters } from './filter-parser.js'
import {
  no,
  isIE,
  extend,
  cached,
  addAttr,
  addProp,
  camelize,
  addHandler,
  addDirective,
  getBindingAttr,
  getAndRemoveAttr,
  genAssignmentCode,
  isServerRendering,
  pluckModuleFunction
} from './util.js'


// 匹配以字符 @ 或 v-on: 开头的字符串
const onRE = /^@|^v-on:/
// 匹配以字符 v- 或 @ 或 : 开头的字符串，主要作用是检测标签属性名是否是指令
const dirRE = /^v-|^@|^:/
// 匹配 v-for 属性的值，并捕获 in 或 of 前后的字符串
// <div v-for="obj of list"></div>  -->  匹配字符串 'obj of list'，并捕获到两个字符串 'obj' 和 'list'
const forAliasRE = /([^]*?)\s+(?:in|of)\s+([^]*)/
// 匹配 forAliasRE 第一个捕获组所捕获到的字符串
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
// 用来捕获要么以字符 ( 开头，要么以字符 ) 结尾的字符串，或者两者都满足
// 去掉匹配到的 '(obj, index)' 的 () , '(obj, index)'.replace(stripParensRE, '')
const stripParensRE = /^\(|\)$/g
// 匹配指令中的参数
// <div v-on:click.stop="handleClick"></div>  -->  click
const argRE = /:(.*)$/
// 匹配以字符 : 或字符串 v-bind: 开头的字符串，主要用来检测一个标签的属性是否是绑定(v-bind)
export const bindRE = /^:|^v-bind:/
// 匹配修饰符的，但是并没有捕获任何东西
// const matchs = 'v-on:click.stop'.match(modifierRE) -->  matchs[0] == '.stop
const modifierRE = /\.[^.]+/g

// he 为第三方的库，he.decode 函数用于 HTML 字符实体的解码工作 https://github.com/mathiasbynens/he
const decodeHTMLCached = cached(he.decode)

// 8 个平台化的变量
let warn
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp
let platformGetTagNamespace

export function createASTElement (tag, attrs, parent) {
  return {
    type: 1,
    tag,
    attrsList: attrs,
    attrsMap: makeAttrsMap(attrs),
    parent,
    children: []
  }
}

// 在词法分析的基础上做句法分析从而生成一棵 AST
export function parse (template, options = {}) {
  // 初始化
  // warn = options.warn || baseWarn
  // 其作用是通过给定的标签名字判断该标签是否是 pre 标签
  platformIsPreTag = options.isPreTag || no
  // 检测一个属性在标签中是否要使用元素对象原生的 prop 进行绑定，注意：这里的 prop 指的是元素对象的属性，而非 Vue 中的 props 概念
  platformMustUseProp = options.mustUseProp || no
  // 其作用是用来获取元素(标签)的命名空间
  platformGetTagNamespace = options.getTagNamespace || no

  transforms = pluckModuleFunction(options.modules, 'transformNode')
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

  // https://cn.vuejs.org/v2/api/#delimiters
  delimiters = options.delimiters

  // 保存当前父级节点的栈
  const stack = []
  // 用来告诉编译器在编译 html 字符串时是否放弃标签之间的空格，如果为 true 则代表放弃
  const preserveWhitespace = options.preserveWhitespace !== false
  // 最终的 AST
  let root
  let currentParent
  // 标识当前解析的标签是否在拥有 v-pre 的标签之内
  let inVPre = false
  // 用来标识当前正在解析的标签是否在 <pre></pre> 标签之内
  let inPre = false
  // 用于接下来定义的 warnOnce 函数
  let warned = false

  // function warnOnce (msg) {
  //   if (!warned) {
  //     warned = true
  //     warn(msg)
  //   }
  // }

  // 每当遇到一个标签的结束标签时，或遇到一元标签时都会调用该方法“闭合”标签
  function closeElement (element) {
    // check pre state
    if (element.pre) {
      inVPre = false
    }
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }
    // apply post-transforms 后置处理
    // 实际上 postTransforms 是一个空数组，因为目前还没有任何后置处理的钩子函数。这里只是暂时提供一个用于后置处理的出口，当有需要的时候可以使用
    for (let i = 0; i < postTransforms.length; i++) {
      postTransforms[i](element, options)
    }
  }

  parseHTML(template, {
    start (tag, attrs, unary, start, end) {
      // 获取命名空间
      // 当前元素存在父级并且父级元素存在命名空间，则使用父级的命名空间作为当前元素的命名空间。
      // 如果父级元素不存在或父级元素没有命名空间，那么会通过调用 platformGetTagNamespace(tag) 函数获取当前元素的命名空间。
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // 处理 IE svg bug http://osgeo-org.1560.x6.nabble.com/WFS-and-IE-11-td5090636.html
      // <svg xmlns:NS1="" NS1:xmlns:feature="http://www.openplans.org/topp"></svg>
      // 修复为
      // <svg xmlns:feature="http://www.openplans.org/topp"></svg>
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      let element = createASTElement(tag, attrs, currentParent)
      // 如果当前解析的开始标签为 svg 标签或者 math 标签或者它们两个的子节点标签，都将会比其他 html 标签的元素描述对象多出一个 ns 属性，且该属性标识了该标签的命名空间。
      if (ns) {
        element.ns = ns
      }

      // <style> 标签和 <script> 都被认为是禁止的标签，因为 Vue 认为模板应该只负责做数据状态到 UI 的映射，而不应该存在引起副作用的代码，如果你的模板中存在 <script> 标签，那么该标签内的代码很容易引起副作用
      // <script type="text/x-template"> 例外
      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
      }

      // 预处理函数处理之后得到了新的元素描述对象，则使用新的元素描述对象替换当前元素描述对象(element)，否则依然使用 element 作为元素描述对象
      for (let i = 0; i < preTransforms.length; i++) {
        element = preTransforms[i](element, options) || element
      }

      if (!inVPre) {
        processPre(element)
        if (element.pre) {
          // 意味着 后续的所有解析工作都处于 v-pre 环境下，编译器会跳过拥有 v-pre 指令元素以及其子元素的编译过程，所以后续的编译逻辑需要 inVPre 变量作为标识才行。
          inVPre = true
        }
      }

      if (platformIsPreTag(element.tag)) {
        inPre = true
      }

      if (inVPre) { // inVPre 为真说明当前解析环境是在 v-pre 环境下
        processRawAttrs(element)
      } else if (!element.processed) { // processed 标识着当前元素是否已经被解析过了
        // structural directives
        processFor(element)
        processIf(element)
        processOnce(element)
        // element-scope stuff
        processElement(element, options)
      }

      // 它的作用是用来检测模板根元素是否符合要求
      // 我们知道在编写 Vue 模板的时候会受到两种约束
      // 首先模板必须有且仅有一个被渲染的根元素，
      // 第二不能使用 slot 标签和 template 标签作为模板的根元素
      function checkRootConstraints (el) {
        // 非生产环境下才提示 warn 信息
        // if (process.env.NODE_ENV !== 'production') {
        if (el.tag === 'slot' || el.tag === 'template') {
          console.log(
            `Cannot use <${el.tag}> as component root element because it may ` +
            'contain multiple nodes.'
          )
        }
        if (el.attrsMap.hasOwnProperty('v-for')) {
          console.log(
            'Cannot use v-for on stateful component root element because ' +
            'it renders multiple elements.'
          )
        }
        // }
      }

      if (platformIsPreTag(element.tag)) {
        inPre = true
      }

      if (!root) {
        root = element
        checkRootConstraints(root)
      } else if (!stack.length) {
        // 当 stack 数组被清空后则说明整个模板字符串已经解析完毕了，
        // 但此时 start 钩子函数仍然被调用了，这说明模板中存在多个根元素

        // 必须有且仅有一个被渲染的根元素，但你可以定义多个根元素，只要能够保证最终只渲染其中一个元素即可，
        // 能够达到这个目的的方式只有一种，那就是在多个根元素之间使用 v-if 或 v-else-if 或 v-else

        if (root.if && (element.elseif || element.else)) {
          // root    第一个根元素的描述对象
          // element 非第一个根元素的描述对象
          checkRootConstraints(element)
          addIfCondition(root, {
            exp: element.elseif,
            block: element
          })
        } else if (true) {
          // 提示 warn
          console.log(
            `Component template should contain exactly one root element. ` +
            `If you are using v-if on multiple elements, ` +
            `use v-else-if to chain them instead.`
          )
        }
      }

      if (currentParent && !element.forbidden) {
        if (element.elseif || element.else) {
          // 如果一个标签使用 v-else-if 或 v-else 指令
          // 那么该元素的描述对象实际上会被添加到对应的 v-if 元素描述对象的 ifConditions 数组中，而非作为一个独立的子节点
          processIfConditions(element, currentParent)
        } else if (element.slotScope) { // scoped slot
          // 如果当前元素没有使用 v-else-if 或 v-else 指令，那么还会判断当前元素是否使用了 slot-scope 特性
          // 说使用了 slot-scope 特性的元素与使用了 v-else-if 或 v-else 指令的元素一样，
          // 他们都不会作为父级元素的子节点，
          // 对于使用了 slot-scope 特性的元素来讲它们将被添加到**父级元素**描述对象的 scopedSlots 对象下
          currentParent.plain = false
          const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        } else {
          currentParent.children.push(element)
          element.parent = currentParent
        }
      }

      if (!unary) {
        // 每当遇到一个非一元标签都会将该元素的描述对象添加到 stack 数组，
        // 并且 currentParent 始终存储的是 stack 栈顶的元素，即当前解析元素的父级。
        currentParent = element
        stack.push(element)
      } else {
        closeElement(element)
      }

    },
    end (tag, start, end) {
      // 每遇到结束标签的时候，currentParent 回退到上一级节点

      // remove trailing whitespace
      // 移除末尾空格
      // e.g. <div><span>test</span> <!-- 空白占位 -->  </div>
      // 也就是移除上面的 空白占位
      const element = stack[stack.length - 1]
      const lastNode = element.children[element.children.length - 1]
      if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
        element.children.pop()
      }
      // pop stack
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      closeElement(element)
    },
    chars (text) { // 遇到文本节点的时候
      if (!currentParent) {
        if (text === template) {
          // eg. <template>我是文本节点</template> 不符合
          console.log(
            'Component template requires a root element, rather than just text.'
          )
        } else if ((text = text.trim())) {
          // <template>
          //   <div>根元素内的文本节点</>根元素外的文本节点
          // </template>
          // 不符合，根元素外的文本节点会被忽略
          console.log(
            `text "${text}" outside root element will be ignored.`
          )
        }
        return
      }

      // IE textarea placeholder bug https://github.com/vuejs/vue/issues/4098
      /** bug
       * <div id="box">
          <textarea placeholder="some placeholder..."></textarea>
        </div>

        document.getElementById('box').innerHTML

        获取的值是 '<textarea placeholder="some placeholder...">some placeholder...</textarea>'
        <textarea> 标签的 placeholder 属性的属性值被设置成了 <textarea> 的真实文本内容

        处理就是
        如果当前文本节点的父元素是 <textarea> 标签，
        并且文本元素的内容和 <textarea> 标签的 placeholder 属性值相同，
        则说明此时遇到了 IE 的 bug，由于只有当 <textarea> 标签没有真实文本内容时才存在这个 bug，
        所以这说明当前解析的文本节点原本就是不存在的，这时 chars 钩子函数会直接 return，
        不做后续处理。
       */
      if (isIE &&
        currentParent.tag === 'textarea' &&
        currentParent.attrsMap.placeholder === text
      ) {
        return
      }

      const children = currentParent.children
      text = inPre || text.trim()
        // script 或者 style 标签内的话直接原封不动返回内容，否则要解码
        ? isTextTag(currentParent) ? text : decodeHTMLCached(text)
        // only preserve whitespace if its not right after a starting tag、
        // 如果 text 是空字符串则代码是不会执行 chars 钩子函数
        // 不存在于 <pre> 标签内的空白符
        // 只会保留那些 不存在于开始标签之后的空格
        // 默认情况下编译器是会保留空格
        : preserveWhitespace && children.length ? ' ' : ''

      /**
       *
        1、如果文本节点存在于 v-pre 标签中，则会被作为普通文本节点对象
        2、<pre> 标签内的空白会被保留
        3、preserveWhitespace 只会保留那些不在开始标签之后的空格(说空白也没问题)
        4、普通文本节点的元素描述对象的类型为 3，即 type = 3
        5、包含字面量表达式的文本节点不会被作为普通的文本节点对待，而是会使用 parseText 函数解析它们，并创建一个类型为 2，即 type = 2 的元素描述对象
       */
      if (text) {
        let res
        if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) {
          // 1、当前文本节点不存在于使用 v-pre 指令的标签之内
          // 2、当前文本节点不是空格字符
          // 3、使用 parseText 函数成功解析当前文本节点的内容
          children.push({
            type: 2,
            expression: res.expression,
            tokens: res.tokens,
            text
          })
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          children.push({
            type: 3,
            text
          })
        }
      }
    },
    comment (text) { // 遇到注释节点，默认不保留
      // 注释节点 和 文本节点的 type 都是 3
      // 但是 注释节点 有个 isComment: true 加以区分 文本节点
      currentParent.children.push({
        type: 3,
        text,
        isComment: true
      })
    }
  })

  return root
}

// 将标签的属性数组转换成名值对一一对象的对象
/**
 *
 * attrs = [
    {
      name: 'v-for',
      value: 'obj of list'
    },
    {
      name: 'class',
      value: 'box'
    }
  ]
  -->
  map = {
    'v-for': 'obj of list',
    'class': 'box'
  }
 */
function makeAttrsMap (attrs) {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    map[attrs[i].name] = attrs[i].value
  }
  return map
}


const ieNSBug = /^xmlns:NS\d+/
const ieNSPrefix = /^NS\d+:/

function guardIESVGBug (attrs) {
  const res = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

function isForbiddenTag (el) {
  return (
    el.tag === 'style' ||
    (el.tag === 'script' && (
      !el.attrsMap.type ||
      el.attrsMap.type === 'text/javascript'
    ))
  )
}

export function addIfCondition (el, condition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}

function processIfConditions (el, parent) {
  const prev = findPrevElement(parent.children)
  // 判断当前元素的前一个元素是否有 v-if 属性，有则把当前元素加到前一个元素的 ifConditions 数组中
  // 没有则提示 warn
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (process.env.NODE_ENV !== 'production') {
    // warn(
    //   `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
    //   `used on element <${el.tag}> without corresponding v-if.`
    // )
  }
}

function findPrevElement (children) {
  let i = children.length
  // 从后向前遍历父级的子节点
  while (i--) {
    // type === 1 是用来找最后一个**元素节点**
    if (children[i].type === 1) {
      return children[i]
    } else {
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
        // 该非元素节点的 .text 属性如果不为空，则打印警告信息提示开发者这部分存在于 v-if 指令和 v-else(-if) 指令之间的内容将被忽略
        // warn(
        //   `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
        //   `will be ignored.`
        // )
        /**
         *
          <div>
            <div v-if="a"></div>
            aaaaa
            <p v-else-if="b"></p>
            bbbbb
            <span v-else="c"></span>
          </div>

          aaaaa bbbbb 都将被忽略
         */
      }
      // 非元素节点被从 children 数组中 pop 出去
      children.pop()
    }
  }
}

function processPre (el) {
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true
  }
}

function processRawAttrs (el) {
  const l = el.attrsList.length
  if (l) {
    const attrs = el.attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      attrs[i] = {
        name: el.attrsList[i].name,
        // el.attrsList[i].value 本身是字符串
        // JSON.stringify 化后确保这个值始终被作为普通的字符串处理
        value: JSON.stringify(el.attrsList[i].value)
      }
    }
  } else if (!el.pre) {
    // non root node in pre blocks with no attributes
    // 这说明该元素一定是使用了 v-pre 指令的标签的子标签，并且该子标签没有属性也没有 v-pre 指令
    el.plain = true
  }
}

export function processFor (el) {
  let exp
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    const res = parseFor(exp)
    if (res) {
      extend(el, res)
    } else if (process.env.NODE_ENV !== 'production') {
      console.log(
        `Invalid v-for expression: ${exp}`
      )
    }
  }
}

export function parseFor (exp) {
  const inMatch = exp.match(forAliasRE)
  if (!inMatch) return
  const res = {}
  res.for = inMatch[2].trim()
  const alias = inMatch[1].trim().replace(stripParensRE, '')
  const iteratorMatch = alias.match(forIteratorRE)
  if (iteratorMatch) {
    // iteratorMatch 匹配 obj, index 的时候
    res.alias = alias.replace(forIteratorRE, '')
    res.iterator1 = iteratorMatch[1].trim()
    if (iteratorMatch[2]) {
     // iteratorMatch 匹配 obj, key, index 的时候
      res.iterator2 = iteratorMatch[2].trim()
    }
  } else {
    // iteratorMatch 匹配 obj 的时候
    res.alias = alias
  }
  return res
}

function processIf (el) {
  const exp = getAndRemoveAttr(el, 'v-if')
  if (exp) {
    el.if = exp
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  } else {
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) {
      el.elseif = elseif
    }
  }
}

function processOnce (el) {
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}

export function processElement (element, options) {
  processKey(element)

  // determine whether this is a plain element after
  // removing structural attributes

  // v-for、v-if/v-else-if/v-else、v-once 等指令会被认为是结构化的指令(structural directives)
  // 这些指令在经过 processFor、processIf 以及 processOnce 等函数处理之后，会把这些指令从元素描述对象的 attrsList 数组中移除
  // 只有当标签没有使用 key 属性，并且标签只使用了结构化指令的情况下才被认为是“纯”的
  element.plain = !element.key && !element.attrsList.length

  processRef(element)
  processSlot(element)
  processComponent(element)
  for (let i = 0; i < transforms.length; i++) {
    element = transforms[i](element, options) || element
  }
  processAttrs(element)
}

function processKey (el) {
  /**
   * <div key="id"></div>            -->  el.key = JSON.stringify('id')
   * <div :key="id"></div>           -->  el.key = 'id'
   * <div :key="id | featId"></div>  -->  el.key = '_f("featId")(id)'
   */

  const exp = getBindingAttr(el, 'key')
  if (exp) {
    if (el.tag === 'template') {
      // key 属性不能被应用到 <template> 标签。
      console.log(`<template> cannot be keyed. Place the key on real elements instead.`)
    }
    el.key = exp
  }
}

function processRef (el) {
  const ref = getBindingAttr(el, 'ref')
  if (ref) {
    el.ref = ref
    // 标识着这个使用了 ref 属性的标签是否存在于 v-for 指令之内
    // 如果 ref 属性存在于 v-for 指令之内，我们需要创建一个组件实例或DOM节点的引用数组，
    // 而不是单一引用，这个时候就需要 el.refInFor 属性来区分了
    el.refInFor = checkInFor(el)
  }
}

function checkInFor (el) {
  let parent = el
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent
  }
  return false
}

function processSlot (el) {
  if (el.tag === 'slot') {
    el.slotName = getBindingAttr(el, 'name')
    if (el.key) {
      console.log(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
        `and can possibly expand into multiple elements. ` +
        `Use the key on a wrapping element instead.`
      )
    }
  } else {
    let slotScope
    if (el.tag === 'template') {
      slotScope = getAndRemoveAttr(el, 'scope')
      if (slotScope) {
        // 使用 slot-scope 属性，好处是 slot-scope 属性不受限于 <template> 标签。
        console.log(
          `the "scope" attribute for scoped slots have been deprecated and ` +
          `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
          `can also be used on plain elements in addition to <template> to ` +
          `denote scoped slots.`,
          true
        )
      }
      el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
    } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {
      if (el.attrsMap['v-for']) {
        // <div slot-scope="slotProps" v-for="item of slotProps.list"></div>
        // 由于 v-for 具有更高的优先级，所以 v-for 绑定的状态将会是**父组件作用域**的状态，**而不是**子组件通过作用域插槽传递的状态

        // 这样不会有歧义
        /**
         * <template slot-scope="slotProps">
            <div v-for="item of slotProps.list"></div>
          </template>
         */
        console.log(
          `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
          `(v-for takes higher priority). Use a wrapper <template> for the ` +
          `scoped slot to make it clearer.`,
          true
        )
      }
      el.slotScope = slotScope
    }
    const slotTarget = getBindingAttr(el, 'slot')
    if (slotTarget) {
      el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
      // preserve slot as an attribute for native shadow DOM compat
      // only for non-scoped slots.
      // 保存原生影子DOM(shadow DOM)的 slot 属性，当然啦既然是原生影子DOM的 slot 属性，那么首先该元素必然应该是原生DOM
      // 保留原生的 slot 属性 https://developer.mozilla.org/en-US/docs/Web/API/Element/slot
      if (el.tag !== 'template' && !el.slotScope) {
        // 函数会将属性的名字和值以对象的形式添加到元素描述对象的 el.attrs 数组中
        addAttr(el, 'slot', slotTarget)
      }
    }
  }
}

function processComponent (el) {
  let binding
  if ((binding = getBindingAttr(el, 'is'))) {
    el.component = binding
  }
  if (getAndRemoveAttr(el, 'inline-template') != null) {
    el.inlineTemplate = true
  }
}

function processAttrs (el) {
  const list = el.attrsList
  let i, l, name, rawName, value, modifiers, isProp
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name
    value = list[i].value
    if (dirRE.test(name)) { // 该属性是一个指令
      // mark element as dynamic
      el.hasBindings = true
      // modifiers
      modifiers = parseModifiers(name)
      if (modifiers) {
        // 移除 name 中的修饰符属性 eg. v-bind:some-prop.sync  -->  v-bind:some-prop
        name = name.replace(modifierRE, '')
      }
      if (bindRE.test(name)) { // v-bind 解析 v-bind 指令
        // v-bind:some-prop  --> some-prop
        name = name.replace(bindRE, '')
        // 调用 parseFilters 函数处理绑定属性的值
        value = parseFilters(value)
        // isProp 变量标识着该绑定的属性是否是原生DOM对象的属性，所谓原生DOM对象的属性就是能够通过DOM元素对象直接访问的有效API，比如 innerHTML 就是一个原生DOM对象的属性。
        isProp = false
        if (modifiers) { // 有修饰符的才走这里
          if (modifiers.prop) {
            isProp = true
            // https://cn.vuejs.org/v2/api/?#v-bind
            name = camelize(name)
            if (name === 'innerHtml') name = 'innerHTML'
          }
          if (modifiers.camel) {
            // https://cn.vuejs.org/v2/api/?#v-bind
            name = camelize(name)
          }
          if (modifiers.sync) {
            // :some-prop.sync <==等价于==> :some-prop + @update:someProp
            addHandler(
              el,
              `update:${camelize(name)}`,
              genAssignmentCode(value, `$event`)
            )
          }
        }
        if (isProp || (
          !el.component && platformMustUseProp(el.tag, el.attrsMap.type, name)
        )) {
          // 元素描述对象的 el.props 数组中存储的并不是组件概念中的 prop，而是原生DOM对象的属性。
          addProp(el, name, value)
        } else {
          addAttr(el, name, value)
        }
      } else if (onRE.test(name)) { // v-on 解析 v-on 指令
        name = name.replace(onRE, '')
        addHandler(el, name, value, modifiers, false)
      } else { // normal directives
        name = name.replace(dirRE, '')
        // parse arg
        const argMatch = name.match(argRE)
        const arg = argMatch && argMatch[1]
        if (arg) {
          name = name.slice(0, -(arg.length + 1))
        }
        // eg. v-custom:arg.modif="myMethod"
        //    addDirective(el, 'custom', 'v-custom:arg.modif', 'myMethod', 'arg', { modif: true })
        addDirective(el, name, rawName, value, arg, modifiers)
        if (name === 'model') { // 在非生产环境下
          checkForAliasModel(el, value)
        }
      }
    } else { // 非指令属性
      // literal attribute
      if (true) {
        // 非生产环境下
        const res = parseText(value, delimiters)
        if (res) {
          console.log(
            `${name}="${value}": ` +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.'
          )
        }
      }
      addAttr(el, name, JSON.stringify(value))
      // #6887 firefox doesn't update muted state if set via attribute
      // even immediately after element creation
      // 火狐的 bug，直接操作真实 dom 去添加 video 的 muted 的属性
      if (!el.component &&
          name === 'muted' &&
          platformMustUseProp(el.tag, el.attrsMap.type, name)) {
        addProp(el, name, 'true')
      }
    }
  }
}

function parseModifiers (name) {
  // eg. v-bind:some-prop.sync  -->  return { sync: true }
  const match = name.match(modifierRE)
  if (match) {
    const ret = {}
    match.forEach(m => { ret[m.slice(1)] = true })
    return ret
  }
}


// list = [1, 2, 3]
// <div v-for="item of list">
//   <input v-model="item" />  v-model 无效
// </div>

// list = [
//   { item: 1 },
//   { item: 2 },
//   { item: 3 },
// ]
// <div v-for="obj of list">
//   <input v-model="obj.item" /> v-model 有效
// </div>
function checkForAliasModel (el, value) {
  let _el = el
  while (_el) {
    if (_el.for && _el.alias === value) {
      console.log(
        `<${el.tag} v-model="${value}">: ` +
        `You are binding v-model directly to a v-for iteration alias. ` +
        `This will not be able to modify the v-for source array because ` +
        `writing to the alias is like modifying a function local variable. ` +
        `Consider using an array of objects and use v-model on an object property instead.`
      )
    }
    _el = _el.parent
  }
}

// for script (e.g. type="x/template") or style, do not decode content
function isTextTag (el) {
  return el.tag === 'script' || el.tag === 'style'
}
