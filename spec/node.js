JSCLASS_PATH = 'vendor/js.class/build/src'
require('../' + JSCLASS_PATH + '/loader')

JS.Packages(function() { with(this) {
  file('build/faye-node.js').provides('Faye')
  autoload(/.*Spec/, {from: 'spec/javascript'})
}})

FakeSocket = function() {
  this._fragments = []
}
FakeSocket.prototype.write = function(buffer, encoding) {
  this._fragments.push([buffer, encoding])
}
FakeSocket.prototype.read = function() {
  var output = []
  this._fragments.forEach(function(buffer, i) {
    for (var j = 0, n = buffer[0].length; j < n; j++)
    output.push(buffer[0][j])
  })
  return output
}

JS.require('Faye', 'JS.Test', 'JS.Range', function() {
  JS.Test.Unit.Assertions.include({
    assertYield: function(expected) {
      var testcase = this
      return function(actual) { testcase.assertEqual(expected, actual) }
    }
  })
  
  JS.ENV.Server = {}
  
  JS.require( 'FayeSpec',
              'GrammarSpec',
              'ChannelSpec',
              'EngineSpec',
              'ServerSpec',
              'Server.HandshakeSpec',
              'Server.ConnectSpec',
              'Server.DisconnectSpec',
              'Server.SubscribeSpec',
              'Server.UnsubscribeSpec',
              'Server.ExtensionsSpec',
              'Server.IntegrationSpec',
              'WebSocket.Draft75ParserSpec',
              'WebSocket.Protocol8ParserSpec',
              'NodeAdapterSpec',
              'ClientSpec',
              'TransportSpec',
              JS.Test.method('autorun'))
})
