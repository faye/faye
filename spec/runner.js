(function() {
  this.JSCLASS_PATH = './vendor/js.class/build/min'
  require('../' + JSCLASS_PATH + '/loader')

  require('../build/faye-node')

  JS.Packages(function() { with(this) {
    autoload(/^.*Spec$/, {from: 'spec/javascript'})
  }})

  JS.require('JS.Set', 'JS.Range', 'JS.Test', function() {
    
    JS.Test.Unit.Assertions.include({
      assertYield: function(expectedValue) {
        var self = this
        return function(actualValue) { self.assertEqual(expectedValue, actualValue) }
      }
    })
    
    JS.require( 'ChannelSpec',
                'EngineSpec',
                
                JS.Test.method('autorun'))
  })
  
})()

