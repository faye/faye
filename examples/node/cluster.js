var faye = require('../../build/node/faye-node');
// faye.Logging.logLevel = 'debug';

var servers = {
  ruby:   {ports: [7070, 9090], path: 'bayeux'},
  node:   {ports: [8000, 8000], path: 'bayeux'},
  cometd: {ports: [8080, 8080], path: 'cometd'}
};

var server  = servers.ruby,
    clientA = new faye.Client('http://localhost:' + server.ports[0] + '/' + server.path),
    clientB = new faye.Client('http://localhost:' + server.ports[1] + '/' + server.path),
    time;

var sub = clientA.subscribe('/chat/foo', function(message) {
  console.log(new Date().getTime() - time);
  console.log(message.text);
  process.exit();
});

sub.callback(function() {
  clientB.connect(function() {
    time = new Date().getTime();
    clientB.publish('/chat/foo', {text: 'Hello, cluster'});
  });
});
