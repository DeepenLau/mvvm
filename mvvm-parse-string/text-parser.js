import {
  parseFilters
} from './filter-parser.js'
import { cached } from './util.js'

const defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g

// 大家都知道我们在使用 Vue 的时候可以通过 delimiters 选项自定义字面量表达式的分隔符，
// 比如我们可以将其配置成 delimiters: ['${', '}']，
// 正是由于这个原因，所以我们不能一味的使用 defaultTagRE 正则去识别字面量表达式，
// 我们需要根据开发者对 delimiters 选项的配置自动生成一个新的正则表达式，并用其匹配文本
const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

export function parseText(text, delimiters) {
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  if (!tagRE.test(text)) {
    // 说明文本中不包含字面量表达式
    return
  }
  // e.g. text = 'abc{{name}}'
  const tokens = []
  const rawTokens = []
  let lastIndex = tagRE.lastIndex = 0
  let match, index, tokenValue
  // 如果匹配成功则 match 变量将会是一个数组
  while ((match = tagRE.exec(text))) {
    // e.g. 'abc' 则匹配成功后 match.index 的值为 3，因为第一个左花括号({)在整个字符串中的索引是 3
    // 3 > 0(lastIndex)
    index = match.index
    // push text token
    if (index > lastIndex) { // 这里截取不是{{}}表达式的部分
      rawTokens.push(tokenValue = text.slice(lastIndex, index))
      tokens.push(JSON.stringify(tokenValue))
      // rawTokens = ['abc']
      // tokens = ["'abc'"]
    }
    // tag token // 这里获取{{}}表达式的内容
    // e.g. text = 'abc{{name}}'
    // match[1] --> 'name'
    const exp = parseFilters(match[1].trim()) // 解析 {{ name | someFilter }}
    tokens.push(`_s(${exp})`)
    rawTokens.push({ '@binding': exp })
    // 到这里
    /**
     * tokens = ["'abc'", '_s(_f("someFilter")(name))']
        rawTokens = [
          'abc',
          {
            '@binding': "_f('someFilter')(name)"
          }
        ]
     */
    // 截取完 {{}} 的内容后更新 lastIndex 的位置，包括后面的 },给下一次循环使用
    lastIndex = index + match[0].length
  }

  // 截取剩余的普通文本并将其添加到 rawTokens 和 tokens 数组中
  if (lastIndex < text.length) {
    rawTokens.push(tokenValue = text.slice(lastIndex))
    tokens.push(JSON.stringify(tokenValue))
    // 到这里
    /**
     * tokens = ["'abc'", '_s(name)', "'def'"]
        rawTokens = [
          'abc',
          {
            '@binding': '_s(name)'
          },
          'def'
        ]
     */
  }

  return {
    expression: tokens.join('+'),
    // 另外这里要强调一点 tokens 数组是用来给 weex 使用的
    tokens: rawTokens
  }
  /**
   * return {
      expression: "'abc'+_s(name)+'def'",
      tokens: [
        'abc',
        {
          '@binding': '_s(name)'
        },
        'def'
      ]
    }
   */
}