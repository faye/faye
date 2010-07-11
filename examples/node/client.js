// This script demonstrates a logger for the chat app. First, start
// the chat server in one terminal then run this in another:
// 
//   $ node examples/node/app.js
//   $ node examples/node/client.js
// 
// The client connects to the chat server and logs all messages
// sent by all connected users.

var sys  = require('sys'),
    faye = require('./faye-node');

var client = new faye.Client('http://localhost:8000/bayeux');

client.subscribe('/from/*', function(message) {
  var user = message.user;
  sys.puts('[' + user + ']: ' + message.message);
  client.publish('/mentioning/' + user, {
    user:   'node-logger',
    message:  'Got your message, ' + user + '!'
  });
});

