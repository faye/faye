var fs    = require('fs'),
    path  = require('path'),
    http  = require('http'),
    https = require('https'),
    mime  = require('mime'),
    faye  = require('../../build/node/faye-node');

var SHARED_DIR = __dirname + '/..',
    PUBLIC_DIR = SHARED_DIR + '/public',

    bayeux     = new faye.NodeAdapter({mount: '/bayeux', timeout: 20}),
    port       = process.argv[2] || '8000',
    secure     = process.argv[3] === 'ssl',
    key        = fs.readFileSync(SHARED_DIR + '/server.key'),
    cert       = fs.readFileSync(SHARED_DIR + '/server.crt');

var handleRequest = function(request, response) {
  var path = (request.url === '/') ? '/index.html' : request.url;

  fs.readFile(PUBLIC_DIR + path, function(err, content) {
    var status = err ? 404 : 200;
    try {
      response.writeHead(status, {'Content-Type': mime.lookup(path)});
      response.end(content || 'Not found');
    } catch (e) {}
  });
};

var server = secure
           ? https.createServer({cert: cert, key: key}, handleRequest)
           : http.createServer(handleRequest);

bayeux.attach(server);
server.listen(Number(port));

bayeux.getClient().subscribe('/chat/*', function(message) {
  console.log('[' + message.user + ']: ' + message.message);
});

bayeux.bind('subscribe', function(clientId, channel) {
  console.log('[  SUBSCRIBE] ' + clientId + ' -> ' + channel);
});

bayeux.bind('unsubscribe', function(clientId, channel) {
  console.log('[UNSUBSCRIBE] ' + clientId + ' -> ' + channel);
});

bayeux.bind('disconnect', function(clientId) {
  console.log('[ DISCONNECT] ' + clientId);
});

console.log('Listening on ' + port + (secure? ' (https)' : ''));

