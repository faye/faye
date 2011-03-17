var faye = require('../../build/faye-node'),
    sys  = require('sys');

var clientA = new Faye.Client('http://localhost:8080/bayeux'),
    clientB = new Faye.Client('http://localhost:9090/bayeux');

clientA.subscribe('/foo', function(message) {
  sys.puts(message.text);
});

setTimeout(function() {
  clientB.publish('/foo', {text: 'Hello, cluster'});
}, 1000);
