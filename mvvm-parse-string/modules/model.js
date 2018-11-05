import {
  addRawAttr,
  getBindingAttr,
  getAndRemoveAttr
} from '../util.js'

import {
  createASTElement,
  processFor,
  processElement,
  addIfCondition
} from '../parse.js'

// 实际上 preTransformNode 函数的处理逻辑就是把一个 input 标签扩展为多个标签，并且些扩展出来的标签彼此之间是互斥的
// 这些扩展出来的标签都存在于元素描述对象的 el.ifConditions 数组中
function preTransformNode (el, options) {
  if (el.tag === 'input') {
    const map = el.attrsMap
    if (!map['v-model']) {
      return
    }

    let typeBinding
    if (map[':type'] || map['v-bind:type']) {
      // eg. <input v-model="val" :type="inputType" />
      typeBinding = getBindingAttr(el, 'type')
    }
    if (!map.type && !typeBinding && map['v-bind']) {
      // eg. <input v-model="val" v-bind="{ type: inputType }" />
      typeBinding = `(${map['v-bind']}).type`
    }

    if (typeBinding) {
      // eg. <input v-model="val" :type="inputType" v-if="display" />
      const ifCondition = getAndRemoveAttr(el, 'v-if', true)
      const ifConditionExtra = ifCondition ? `&&(${ifCondition})` : ``
      const hasElse = getAndRemoveAttr(el, 'v-else', true) != null
      const elseIfCondition = getAndRemoveAttr(el, 'v-else-if', true)
      // 1. checkbox
      const branch0 = cloneASTElement(el)
      // process for on the main node
      // v-once 不必处理，因为 v-model 肯定是动态的
      // v-if 上面已经处理了
      processFor(branch0)
      addRawAttr(branch0, 'type', 'checkbox')
      processElement(branch0, options)
      branch0.processed = true // prevent it from double-processed
      // eg. <input v-model="val" :type="inputType" v-if="display" />
      // el.if = '(${inputType})==='checkbox'&&display
      branch0.if = `(${typeBinding})==='checkbox'` + ifConditionExtra
      // 一个标签使用了 v-if 指令，则该标签的元素描述对象被添加到其自身的 el.ifConditions 数组中
      addIfCondition(branch0, {
        exp: branch0.if,
        block: branch0
      })
      // 2. add radio else-if condition
      const branch1 = cloneASTElement(el)
      // 单纯的将克隆出来的元素描述对象中的 v-for 属性移除掉，因为在复选按钮中已经使用 processFor 处理过了 v-for 指令，由于它们本是互斥的，其本质上等价于是同一个元素，只是根据不同的条件渲染不同的标签罢了，所以 v-for 指令处理一次就够了
      getAndRemoveAttr(branch1, 'v-for', true)
      addRawAttr(branch1, 'type', 'radio')
      processElement(branch1, options)
      addIfCondition(branch0, {
        exp: `(${typeBinding})==='radio'` + ifConditionExtra,
        block: branch1
      })
      // 3. other
      const branch2 = cloneASTElement(el)
      // 单纯的将克隆出来的元素描述对象中的 v-for 属性移除掉，因为在复选按钮中已经使用 processFor 处理过了 v-for 指令，由于它们本是互斥的，其本质上等价于是同一个元素，只是根据不同的条件渲染不同的标签罢了，所以 v-for 指令处理一次就够了
      getAndRemoveAttr(branch2, 'v-for', true)
      addRawAttr(branch2, ':type', typeBinding)
      processElement(branch2, options)
      addIfCondition(branch0, {
        exp: ifCondition,
        block: branch2
      })

      if (hasElse) {
        branch0.else = true
      } else if (elseIfCondition) {
        branch0.elseif = elseIfCondition
      }

      return branch0
    }
  }
}

function cloneASTElement (el) {
  return createASTElement(el.tag, el.attrsList.slice(), el.parent)
}

export default {
  preTransformNode
}