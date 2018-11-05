import {
  no,
  makeMap,
  isUnaryTag,
  canBeLeftOpenTag,
  isNonPhrasingTag,
  shouldDecodeNewlines,
  shouldDecodeNewlinesForHref
} from './util.js'

const isUnaryTag1 = isUnaryTag
const canBeLeftOpenTag1 = canBeLeftOpenTag
// 是否保留注释节点 https://cn.vuejs.org/v2/api/#comments
const shouldKeepComment = true
// 匹配标签的属性（4种方式）
// 1、使用双引号把值引起来：class="some-class"
// 2、使用单引号把值引起来：class='some-class'
// 3、不使用引号：class=some-class
// 4、单独的属性名：disabled
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/

// 不包含前缀的XML标签名称
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
// qname:合法的XML标签
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
// 匹配开始标签的一部分，这部分包括：< 以及后面的 标签名称
const startTagOpen = new RegExp(`^<${qnameCapture}`)
// 匹配开始标签的 < 以及标签的名字，但是并不包括开始标签的闭合部分，即：> 或者 />，由于标签可能是一元标签，所以开始标签的闭合部分有可能是 />，比如：<br />，如果不是一元标签，此时就应该是：>
const startTagClose = /^\s*(\/?)>/
// 匹配结束标签
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
// 匹配文档的 DOCTYPE 标签 <!DOCTYPE
const doctype = /^<!DOCTYPE [^>]+>/i

// 匹配开头的注释节点字符串  <!--
const comment = /^<!\--/
// 匹配开头的条件注释节点字符串 <![ ]>
const conditionalComment = /^<!\[/

// 解决老版本火狐的 bug
let IS_REGEX_CAPTURING_BROKEN = false
'x'.replace(/x(.)?/g, function (m, g) {
  IS_REGEX_CAPTURING_BROKEN = g === ''
})

const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML(html, options) {
  const stack = []
  const expectHTML = true // only false for non-web builds
  // 检测一个标签是否是一元标签
  const isUnaryTag = isUnaryTag1 || no
  // 检测一个标签是否是可以省略闭合标签的非一元标签。
  const canBeLeftOpenTag = canBeLeftOpenTag1 || no
  // 标识着当前字符流的读入位置
  let index = 0
  // 存储剩余还未 parse 的 html 字符串
  let last
  // 始终存储着位于 stack 栈顶的元素
  let lastTag

  while (html) {
    last = html

    if (!lastTag || !isPlainTextElement(lastTag)) {
      /* 确保即将 parse 的内容不是在纯文本标签里面（script, style, textarea），即处理非纯文本标签 */

      // html 字符串中左尖括号(<)第一次出现的位置
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // 第一个字符就是左尖括号; 比如 html 字符串为：<div>asdf</div>，那么这个字符串的第一个字符就是左尖括号(<)

        // 第一个字符就是左尖括号(<)的几种情况
        //
        //
        //
        //
        //
        // 6、可能只是一个单纯的字符串：<abcdefg


        // Comment:
        if (comment.test(html)) {
          // 1、可能是注释节点：<!-- -->
          // 要再检查有 --> 才能确定是注释节点
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            // https://cn.vuejs.org/v2/api/#comments
            if (shouldKeepComment) {
              // 通过调用字符串的 substring 方法截取注释内容，其中起始位置是 4，结束位置是 commentEnd 的值
              /**
               * <!-- This is a comment -->
               *     ↑                  ↑
               * 01234                  commentEnd
               */
              options.comment(html.substring(4, commentEnd))
            }

            /**
             *                     commentEnd + 3
             *                           ↓
             * <!-- This is a comment --><div></div>
             *                        ↑
             *                        commentEnd
             */
            advance(commentEnd + 3)
            // 剔除完毕，开启下一次循环，重新开始 parse 过程
            continue
          }
        }

        if (conditionalComment.test(html)) {
          // 2、可能是条件注释节点：<![ ]>
          // 要再检查有 ]> 才能确定是注条件释节点
          if (conditionalComment.test(html)) {
            const conditionalEnd = html.indexOf(']>')

            if (conditionalEnd >= 0) {
              advance(conditionalEnd + 2)
              continue
            }
          }
        }

        // Doctype:
        // Doctype 也没有提供相应的 parser 钩子
        // 即 Vue 不会保留 Doctype 节点的内容。不过大家不用担心，因为在原则上 Vue 在编译的时候根本不会遇到 Doctype 标签
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          // 3、可能是 doctype：<!DOCTYPE >
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        const endTagMatch = html.match(endTag) // <div></div> --> endTagMatch = ['</div>', 'div']
        if (endTagMatch) {
          // 4、可能是结束标签：</xxx>
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
        }

        // Start tag:
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          // 5、可能是开始标签：<xxx>
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(lastTag, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      if (textEnd >= 0) {
        // html = '0<1<2'   rest = html.slice(textEnd)
        // rest = '<1<2'
        rest = html.slice(textEnd)
        // 循环条件保证截取后的字符串不能匹配标签，'<' 存在于普通文本中
        // 直到遇到一个能够成功匹配标签的 < 符号为止
        while (
          !endTag.test(rest) &&           // 不是结束标签
          !startTagOpen.test(rest) &&     // 不是开始标签
          !comment.test(rest) &&          // 不是注释
          !conditionalComment.test(rest)  // 不是条件注释
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1) // rest = '<1<2' , next = 2
          if (next < 0) break // 找不到 '<' 的话，next 为 -1，退出循环
          textEnd += next // 更新 textEnd 位置
          rest = html.slice(textEnd) // 截取新 textEnd 位置，继续下一轮循环
        }
        // 如果 html = '0<1<2'
        // 此时 textEnd 保存着字符串中第二个 < 符号的位置索引
        text = html.substring(0, textEnd) // text = '0<1'
        // 解析到这里要剔除的部分为普通字符串
        advance(textEnd)
      }

      if (textEnd < 0) {
        // 把整个 html 作为文本处理
        text = html
        html = ''
      }

      if (options.chars && text) {
        options.chars(text)
      }

    } else {
      // 即将 parse 的内容是在纯文本标签里 (script,style,textarea)，即处理纯文本标签

      /**
       * 假设 html = '<textarea>aaaabbbb</textarea>'
       * <textarea> 会按正常标签解析，然后剩下的 'aaaabbbb</textarea>' 走这里的 else 分支
       */
      let endTagLength = 0 // 用来保存纯文本标签闭合标签的字符长度
      const stackedTag = lastTag.toLowerCase()
      // 匹配纯文本标签的内容以及结束标签
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      // 把匹配成功的字符串替换成空字符串
      // 假设 html = 'aaaabbbb</textarea>ddd' ，匹配成功的是 'aaaabbbb</textarea>'，替换成成 ''
      // 所以最终 rest = 'ddd'，也就是 html 后面剩余的字符串，给下一次循环使用
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        // all: 保存着整个匹配的字符串，即：aaaabbbb</textarea>
        // text: 第一个捕获组的值，也就是纯文本标签的内容，即：aaaabbbb
        // endTag: 保存着结束标签，即：</textarea>

        endTagLength = endTag.length

        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          // 忽略 <pre> <textarea> 标签的内容中的第一个换行符
          // 所以从第1个开始截取，不从第0个开始
          text = text.slice(1)
        }

        if (options.chars) {
          options.chars(text)
        }

        return ''
      })

      // rest 常量保存着剩余的字符串，所以二者的差就是被替换掉的那部分字符串的字符数
      index += html.length - rest.length
      html = rest // 更新剩余字符串
      // 解析纯文本标签的结束标签
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    // 将整个字符串作为文本对待
    // '<2' 经过 textEnd === 0 和 textEnd >= 0 的处理后，没有任何改变，所以走到了这里
    if (html === last) {
      // 说明字符串 html 在经历循环体的代码之后没有任何改变，此时会把 html 字符串作为纯文本对待
      // '<2' 最终作为普通字符串对待
      options.chars && options.chars(html)
      // 假设 html = <div></div><a
      // 解析完 <div></div> 后清空了 stack ，剩下 <a
      // 有剩余字符串，但是 stack 被清空
      if (!stack.length) {
        // 提示 字符串的结尾不符合标签格式
        // options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
  }

  // 调用 parseEndTag 函数
  parseEndTag()

  // advance 函数
  function advance (n) { // 将已经 parse 完毕的字符串剔除
    // index 是前面定义的当前字符流的读入位置，每次剔除的时候都要更新一下位置
    index += n
    html = html.substring(n)
  }

  // parseStartTag 函数用来 parse 开始标签
  function parseStartTag () {
    const start = html.match(startTagOpen)
    // <div></div> --> start = ['<div', 'div']
    if (start) {
      const match = {
        tagName: start[1],       // 它的值为 start[1] 即标签的名称。
        attrs: [],               // 它的初始值是一个空数组，我们知道，开始标签是可能拥有属性的，而这个数组就是用来存储将来被匹配到的属性。
        start: index             // 它的值被设置为 index，也就是当前字符流读入位置在整个 html 字符串中的相对位置。
      }
      // 开始标签的开始部分就匹配完成，剔除掉 `<div`
      advance(start[0].length)

      let end, attr
      // 循环的条件：1.没有匹配到开始标签的结束部分，2.匹配到了开始标签中的属性
      // 直到遇到开始标签的结束部分为止
      /**
       * <div v-for="v in map"></div>
       * -->
       * attr = [
          ' v-for="v in map"',
          'v-for',
          '=',
          'v in map',
          undefined,
          undefined
        ]
       */
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        // 匹配到属性，然后在 html 中剔除，push 进前面 match 的对象中的 attrs 数组
        advance(attr[0].length)
        match.attrs.push(attr)
      }

      // 直到 匹配到开始标签的结束部分 或者 匹配不到属性 的时候上面的循环停止
      // end = html.match(startTagClose)
      if (end) {
        /**
         * <br />  -->  end = ['/>', '/']
         * <div>   -->  end = ['>', undefined]
         * 所以，如果 end[1] 不为 undefined，那么说明该标签是一个 一元标签
         */
        // match 添加 `一元斜杠` 属性
        match.unarySlash = end[1]
        // 剔除结束标签 '/>' or '>'
        advance(end[0].length)
        match.end = index
        return match

        /**
         * <div v-if="isSucceed" v-for="v in map"></div>  // todo 为啥 match.end 不是在这个位置的前一个位置 '>' 上
         * ↑                                      ↑
         * match.start                         match.end
         *
         * match 变量为
         *
         * match = {
            tagName: 'div',
            attrs: [
              [
                ' v-if="isSucceed"',
                'v-if',
                '=',
                'isSucceed',
                undefined,
                undefined
              ],
              [
                ' v-for="v in map"',
                'v-for',
                '=',
                'v in map',
                undefined,
                undefined
              ]
            ],
            start: index,
            unarySlash: undefined,
            end: index
          }
         */
      }
    }
  }

  // handleStartTag 函数用来处理 parseStartTag 的结果 （startTagMatch）
  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    if (expectHTML) {
      // 其中 p 标签本身的内容模型是 流式内容(Flow content)，并且 p 标签的特性是只允许包含 段落式内容(Phrasing content)
      // 条件成立的情况:
      // <p><h2></h2></p>
      // h2 标签的内容模型属于 非段落式内容(Phrasing content) 模型，所以会立即调用 parseEndTag(lastTag) 函数闭合 p 标签，此时由于强行插入了 </pre> 标签
      // <p></p><h2></h2></p>
      // <h2></h2>正常解析，解析器遇到 p 标签或者 br 标签的结束标签时会补全他们
      // <p></p><h2></h2><p></p>
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }

      // 当前正在解析的标签是一个可以省略结束标签的标签，并且与上一次解析到的开始标签相同
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    // 自定义组件也有一元标签的情况
    const unary = isUnaryTag(tagName) || !!unarySlash
    const l = match.attrs.length
    const attrs = new Array(l) // todo 提前定义一个已知长度的数组，后面循环直接给每一项赋值，而不是 push 或者直接定义 [] 空数组然后给每一项赋值，提高性能？？

    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]

      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') { delete args[3] }
        if (args[4] === '') { delete args[4] }
        if (args[5] === '') { delete args[5] }
      }

      const value = args[3] || args[4] || args[5]
      const shouldDecodeNewLines = tagName === 'a' && args[1] === 'href'
        ? shouldDecodeNewlinesForHref
        : shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
    }

    // 如果开始标签是非一元标签，则将该开始标签的信息入栈，即 push 到 stack 数组中，并将 lastTag 的值设置为该标签名
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName
    }
    // 开始 start 钩子函数
    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  // parseEndTag 函数用来 parse 结束标签
  function parseEndTag (tagName, start, end) {
    // 主要有三个作用
    // 1.检测是否缺少闭合标签
    // 2.处理 stack 栈中剩余的标签
    // 3.解析 </br> 与 </p> 标签，与浏览器的行为相同

    // 该函数三种使用方式
    // 1.处理普通的结束标签，此时 三个参数都传递
    // 2.只传递第一个参数：parseEndTag(lastTag)（在 handleStartTag 函数中使用过）
    // 3.不传递参数，处理 stack 栈剩余未处理的标签

    // pos 变量会被用来判断是否有元素缺少闭合标签
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    if (tagName) { // 转小写
      lowerCasedTagName = tagName.toLowerCase()
    }

    // 寻找当前解析的结束标签所对应的开始标签在 stack 栈中的位置
    if (tagName) {
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (i > pos || !tagName) {
          // 非生产环境下提示有标签未闭合
          // options.warn(
          //   `tag <${stack[i].tag}> has no matching end tag.`
          // )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      // 在 stack 中移除没有闭合的元素
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
