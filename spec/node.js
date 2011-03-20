JSCLASS_PATH = 'vendor/js.class/build/src'
require('../' + JSCLASS_PATH + '/loader')

JS.Packages(function() { with(this) {
  file('build/faye-node.js').provides('Faye')
  autoload(/.*Spec/, {from: 'spec/javascript'})
}})

JS.require('Faye', 'JS.Test', 'JS.Range', function() {
  JS.Test.Unit.Assertions.include({
    assertYield: function(expected) {
      var testcase = this
      return function(actual) { testcase.assertEqual(expected, actual) }
    }
  })
  
  JS.require( 'FayeSpec',
              'GrammarSpec',
              'ChannelSpec',
              'EngineSpec',
              'ServerSpec',
              'NodeAdapterSpec',
              JS.Test.method('autorun'))
})
