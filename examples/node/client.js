// This script demonstrates a logger for the chat app. First, start
// the chat server in one terminal then run this in another:
// 
//   $ node examples/node/server.js
//   $ node examples/node/client.js
// 
// The client connects to the chat server and logs all messages
// sent by all connected users.

var faye = require('../../build/faye-node'),
    
    port     = process.argv[2] || 8000,
    path     = process.argv[3] || 'bayeux',
    scheme   = process.argv[4] === 'ssl' ? 'https' : 'http',
    endpoint = scheme + '://localhost:' + port + '/' + path;

console.log('Connecting to ' + endpoint);
var client = new faye.Client(endpoint);

client.subscribe('/chat/*', function(message) {
  var user = message.user;
  
  client.publish('/members/' + user, {
    user:     'node-logger',
    message:  ' Got your message, ' + user + '!'
  });
});

client.bind('transport:down', function() {
  console.log('[CONNECTION DOWN]');
});

client.bind('transport:up', function() {
  console.log('[CONNECTION UP]');
});

