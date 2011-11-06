var faye   = require('../../build/faye-node'),
    port   = process.argv[2] || 7000,
    socket = new faye.WebSocket.Client('socket://localhost:' + port + '/')

socket.onopen = function(event) {
  console.log('open')
  socket.send(JSON.stringify({channel: '/meta/subscribe', subscription: '/foo'}))
}

socket.onmessage = function(event) {
  console.log('message', event.data)
  socket.close(1002, 'Going away')
}

socket.onclose = function(event) {
  console.log('close', event.code, event.reason)
}
