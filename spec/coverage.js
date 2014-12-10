var fs        = require('fs'),
    path      = require('path'),
    http      = require('http'),
    WebSocket = require('faye-websocket');

var server = http.createServer(),
    report = path.join(__dirname, '../coverage.json');

server.on('upgrade', function(request, socket, body) {
  var ws   = new WebSocket(request, socket, body),
      file = fs.createWriteStream(report);

  ws.pipe(file);
});

server.listen(4180);
