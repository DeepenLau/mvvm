export const TEXT_REG = /\{\{([^}]+)\}\}/g // 匹配 {{}} 的内容

// 匹配以字符 : 或字符串 v-bind: 开头的字符串，主要用来检测一个标签的属性是否是绑定(v-bind)
export const bindRE = /^:|^v-bind:/