// 字母、数字、)、.、+、-、_、$、] 之一
const validDivisionCharRE = /[\w).+\-_$\]]/

export function parseFilters (exp) {
  // 标识当前读取的字符是否在由单引号包裹的字符串中
  let inSingle = false
  // 标识当前读取的字符是否在由 双引号 包裹的字符串中。
  let inDouble = false
  // 标识当前读取的字符是否在 模板字符串 中。
  let inTemplateString = false
  // 标识当前读取的字符是否在 正则表达式 中。
  let inRegex = false

  // 在解析绑定的属性值时，每遇到一个左花括号({)，则 curly 变量的值就会加一，每遇到一个右花括号(})，则 curly 变量的值就会减一
  let curly = 0
  // 在解析绑定的属性值时，每遇到一个左方括号([)，则 square 变量的值就会加一，每遇到一个右方括号(])，则 square 变量的值就会减一
  let square = 0
  // 在解析绑定的属性值时，每遇到一个左圆括号(()，则 paren 变量的值就会加一，每遇到一个右圆括号())，则 paren 变量的值就会减一
  let paren = 0
  // 如果以上三个变量至少有一个不为 0，则说明该管道符存在于花括号或方括号或圆括号之内，这时该管道符是不会被作为过滤器的分界线的
  // eg. <div :key="(aa | bb)"></div>


  let lastFilterIndex = 0
  // 当前读入字符所对应的 ASCII 码
  let c
  // 保存的则是当前字符的前一个字符所对应的 ASCII 码
  let prev
  // 当前读入字符的位置索引
  let i
  // parseFilters 函数的返回值
  let expression
  // 将来会是一个数组，它保存着所有过滤器函数名。
  let filters

  for (i = 0; i < exp.length; i++) {
    prev = c
    c = exp.charCodeAt(i)
    if (inSingle) {
      // 如果当前读取的字符存在于由单引号包裹的字符串内，则会执行这里的代码

      // 0x27 为字符单引号(')所对应的 ASCII 码
      // 0x5C 则是字符反斜杠(\)所对应的 ASCII 码
      // 当前字符是单引号，并且前一个字符不是转义字符(\)。这说明当前字符(单引号)就应该是字符串的结束
      if (c === 0x27 && prev !== 0x5C) inSingle = false
    } else if (inDouble) {
      // 如果当前读取的字符存在于由双引号包裹的字符串内，则会执行这里的代码

      // 0x22 为字符单引号(")所对应的 ASCII 码
      // 当前字符是双引号，并且前一个字符不是转义字符(\)。这说明当前字符(双引号)就应该是字符串的结束
      if (c === 0x22 && prev !== 0x5C) inDouble = false
    } else if (inTemplateString) {
      // 如果当前读取的字符存在于模板字符串内，则会执行这里的代码

      // 0x60 为字符单引号(`)所对应的 ASCII 码
      // 当前字符是模板字符串，并且前一个字符不是转义字符(\)。这说明当前字符(模板字符串)就应该是字符串的结束
      if (c === 0x60 && prev !== 0x5C) inTemplateString = false
    } else if (inRegex) {
      // 如果当前读取的字符存在于正则表达式内，则会执行这里的代码

      // 0x2f 为字符单引号(/)所对应的 ASCII 码
      // 当前字符是正则表达式，并且前一个字符不是转义字符(\)。这说明当前字符(正则表达式)就应该是字符串的结束
      if (c === 0x2f && prev !== 0x5C) inRegex = false
    } else if (
      c === 0x7C && // pipe 0x7C 为管道符(|)所对应的 ASCII 码
      exp.charCodeAt(i + 1) !== 0x7C && // 该字符的后一个字符不能是管道符
      exp.charCodeAt(i - 1) !== 0x7C && // 该字符的前一个字符不能是管道符
      !curly && !square && !paren // 该字符不能处于花括号、方括号、圆括号之内
    ) {
      // 如果当前读取的字符是过滤器的分界线，则会执行这里的代码
      if (expression === undefined) {
        // first filter, end of expression
        // <div :key="id | featId"></div>
        // expression = 'id'
        lastFilterIndex = i + 1
        expression = exp.slice(0, i).trim()
      } else {
        pushFilter()
      }
    } else {
      // 当不满足以上条件时，执行这里的代码
      switch (c) {
        case 0x22: inDouble = true; break         // "
        case 0x27: inSingle = true; break         // '
        case 0x60: inTemplateString = true; break // `
        case 0x28: paren++; break                 // (
        case 0x29: paren--; break                 // )
        case 0x5B: square++; break                // [
        case 0x5D: square--; break                // ]
        case 0x7B: curly++; break                 // {
        case 0x7D: curly--; break                 // }
      }

      if (c === 0x2f) { // /
        let j = i - 1
        let p
        // find first non-whitespace prev char
        for (; j >= 0; j--) {
          p = exp.charAt(j)
          if (p !== ' ') break
        }
        if (!p || !validDivisionCharRE.test(p)) {
          inRegex = true
        }
      }
    }
  }

  if (expression === undefined) {
    expression = exp.slice(0, i).trim()
  } else if (lastFilterIndex !== 0) {
    pushFilter()
  }

  function pushFilter () {
    // <div :key="id | featId"></div>
    //                ↑      ↑
    //     lastFilterIndex   i
    (filters || (filters = [])).push(exp.slice(lastFilterIndex, i).trim())
    lastFilterIndex = i + 1
  }

  if (filters) {
    for (i = 0; i < filters.length; i++) {
      //                 前一个赋值完的表达式 `_f("filter1")(id)`
      //                         ↓
      expression = wrapFilter(expression, filters[i])
      // 第二个过滤器返回的是  '_f("filter1")(_f("filter1")(id))' ，后面以此类推，前一个的函数的调用字符串整体作为下一个的参数
    }
  }

  return expression
}

function wrapFilter (exp, filter) {
  const i = filter.indexOf('(')
  if (i < 0) {
    // _f: resolveFilter
    // 如果没有过滤器没有 '(' ，exp 则作为第一个参数传递
    return `_f("${filter}")(${exp})`
  } else {
    const name = filter.slice(0, i)
    const args = filter.slice(i + 1)
    return `_f("${name}")(${exp}${args !== ')' ? ',' + args : args}`
  }
}