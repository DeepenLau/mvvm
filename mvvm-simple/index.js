import Mvvm from './Mvvm.js'

let vm = new Mvvm({
  el: '#app',
  data: {
    foo: 'bar',
    a: {c: 1}
  }
})
window.vm = vm
setTimeout(() => {
  vm.$data.foo = 'new bar'
}, 2000)