// This script demonstrates error handling

var faye = require('../../build/faye-node'),    
    port = process.argv[2] || 8000,
    path = process.argv[3] || 'bayeux';

var client = new faye.Client('http://localhost:' + port + '/' + path);

var subscription = client.subscribe('/chat/*', function(message) {
  var user = message.user;
  
  var publication = client.publish('/members/' + user, {
    user:     'node-logger',
    message:  'Got your message, ' + user + '!'
  });
  publication.callback(function() {
    console.log('publish succeeded');
  });
  publication.errback(function(error) {
    console.log('publish failed', error);
  });
});

subscription.callback(function() {
  console.log('subscribe succeeded');
});

subscription.errback(function(error) {
  console.log('subscribe failed', error);
});

