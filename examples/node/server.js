var fs    = require('fs'),
    path  = require('path'),
    http  = require('http'),
    faye  = require('../../build/faye-node');

faye.Logging.logLevel = 'debug';

var PUBLIC_DIR = path.dirname(__filename) + '/../shared/public',
    bayeux     = new faye.NodeAdapter({mount: '/bayeux', timeout: 20}),
    port       = process.ARGV[2] || '8000';

//bayeux.getClient().subscribe('/chat/*', function(message) {
//  console.log('[' + message.user + ']: ' + message.message);
//});

var server = http.createServer(function(request, response) {
  var path = (request.url === '/') ? '/index.html' : request.url;
  fs.readFile(PUBLIC_DIR + path, function(err, content) {
    var status = err ? 404 : 200;
    response.writeHead(status, {'Content-Type': 'text/html'});
    response.write(content || 'Not found');
    response.end();
  });
});

bayeux.attach(server);
server.listen(Number(port));

console.log('Listening on ' + port);

