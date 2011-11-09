var faye = require('../../../build/faye-node'),
    http = require('http');

var port = process.argv[2] || 7000;

var server = http.createServer();
server.addListener('upgrade', function(request, socket, head) {
  var socket = new faye.WebSocket(request, head);
  
  socket.onmessage = function(event) {
    socket.send(event.data);
  };
  
  socket.onclose = function(event) {
    console.log('close', event.code, event.reason);
    socket = null;
  };
});

server.listen(port);
