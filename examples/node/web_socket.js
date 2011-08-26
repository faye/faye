var faye = require('../../build/faye-node'),
    ws   = new faye.WebSocket.Client('ws://localhost:8000/bayeux')

ws.onopen = function() {
  console.log('OPEN')
  ws.send(JSON.stringify({channel: '/meta/subscribe', subscription: '/foo'}))
}

ws.onmessage = function(message) {
  console.log(message.data)
}
