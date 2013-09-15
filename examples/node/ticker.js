var faye = require('../../build/node/faye-node');

var client = new faye.Client('http://localhost:8000/bayeux'),
    n      = 0;

setInterval(function() {
  client.publish('/tick', {n: ++n});
}, 1000);
