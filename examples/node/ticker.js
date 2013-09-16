var faye = require('../../build/node/faye-node');

var endpoint = process.argv[2] || 'http://localhost:8000/bayeux',
    client   = new faye.Client(endpoint),
    n        = 0;

setInterval(function() {
  client.publish('/chat/tick', {n: ++n});
}, 1000);
