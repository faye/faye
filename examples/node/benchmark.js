var faye = require('../../build/faye-node'),
    
    port   = process.argv[2] || 8000,
    path   = process.argv[3] || 'bayeux',
    scheme = process.argv[4] === 'ssl' ? 'https' : 'http';

var A = new faye.Client(scheme + '://localhost:' + port + '/' + path),
    B = new faye.Client(scheme + '://localhost:' + port + '/' + path);

A.connect(function() {
  B.connect(function() {
    
    var time = new Date().getTime(),
        MAX  = 1000;
    
    var stop = function() {
      console.log(new Date().getTime() - time);
      process.exit();
    };
    
    var handle = function(client, channel) {
      return function(message) {
        if (message.n === MAX) return stop();
        client.publish(channel, {n: message.n + 1});
      };
    };
    
    var subA = A.subscribe('/chat/a', handle(A, '/chat/b')),
        subB = B.subscribe('/chat/b', handle(B, '/chat/a'));
    
    subA.callback(function() {
      subB.callback(function() {
        console.log('START');
        A.publish('/chat/b', {n: 0});
      });
    });
  });
});

