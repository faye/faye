var faye = require('../../build/faye-node'),
    http = require('http');

var port = process.argv[2] || 7000;

var server = http.createServer();
server.addListener('upgrade', function(request, socket, head) {
  var socket = new Faye.WebSocket(request, head);
  socket.onmessage = function(message) {
    socket.send(message.data);
  };
});

server.listen(port);
