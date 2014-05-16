JS = require('jstest')
Faye = require('../build/node/faye-node')

JS.packages(function() { with(this) {
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
FakeSocket.prototype.on = function() {}

JS.ENV.Engine = {}
JS.ENV.Server = {}

JS.require( 'FayeSpec',
            'GrammarSpec',
            'PublisherSpec',
            'ChannelSpec',
            'EngineSpec',
            'Engine.MemorySpec',
            'ServerSpec',
            'Server.HandshakeSpec',
            'Server.ConnectSpec',
            'Server.DisconnectSpec',
            'Server.SubscribeSpec',
            'Server.UnsubscribeSpec',
            'Server.PublishSpec',
            'Server.ExtensionsSpec',
            'Server.IntegrationSpec',
            'NodeAdapterSpec',
            'ClientSpec',
            'UriSpec',
            'TransportSpec',
            function() { JS.Test.autorun() })
