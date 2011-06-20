var faye = require('../../build/faye-node');

var clientA = new Faye.Client('http://localhost:8080/bayeux'),
    clientB = new Faye.Client('http://localhost:9090/bayeux'),
    time;

var sub = clientA.subscribe('/chat/foo', function(message) {
  console.log(new Date().getTime() - time);
  console.log(message.text);
});

sub.callback(function() {
  time = new Date().getTime();
  clientB.publish('/chat/foo', {text: 'Hello, cluster'});
});
