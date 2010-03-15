var Scenario = require('./scenario'),
    faye     = require('../build/faye'),
    assert   = require('assert');

Faye.Client.prototype.CONNECTION_TIMEOUT = 5;

(function() {
  var tree = new Faye.Channel.Tree();
  var list = '/foo/bar /foo/boo /foo /foobar /foo/bar/boo /foobar/boo /foo/* /foo/**'.split(' ');
  
  Faye.each(list, function(c, i) { tree.set(c, i + 1) });
  
  assert.deepEqual(tree.glob('/foo/*').sort(),        [1,2,7,8]);
  assert.deepEqual(tree.glob('/foo/bar').sort(),      [1,7,8]);
  assert.deepEqual(tree.glob('/foo/**').sort(),       [1,2,5,7,8]);
  assert.deepEqual(tree.glob('/foo/bar/boo').sort(),  [5,8]);
  
  tree.set('/channels/hello', 'A');
  tree.set('/channels/name', 'B');
  tree.set('/channels/nested/hello', 'C');
  
  assert.deepEqual(tree.glob('/channels/**').sort(), ['A','B','C']);
})();

Scenario.run("Server goes away, subscriptions should be revived",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  killServer();
  server(8000);
  wait(6);
  send('B', '/channels/a', {hello: 'world'});
  checkInbox({
      A: {
        '/channels/a': [{hello: 'world'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, no messages delivered",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  send('B', '/channels/b', {hello: 'world'});
  checkInbox({
      A: {},
      B: {}
  });
}});

Scenario.run("Two HTTP clients, single subscription",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  send('B', '/channels/a', {hello: 'world'});
  checkInbox({
      A: {
        '/channels/a': [{hello: 'world'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, multiple subscriptions",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a', '/channels/*']);
  httpClient('B', []);
  send('B', '/channels/a', {hello: 'world'});
  checkInbox({
      A: {
        '/channels/a': [{hello: 'world'}],
        '/channels/*': [{hello: 'world'}]
      },
      B: {}
  });
}});

Scenario.run("Three HTTP clients, single receiver",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  httpClient('C', ['/channels/c']);
  send('B', '/channels/a', {chunky: 'bacon'});
  checkInbox({
      A: {
        '/channels/a': [{chunky: 'bacon'}]
      },
      B: {},
      C: {}
  });
}});

Scenario.run("Three HTTP clients, multiple receivers",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/shared']);
  httpClient('B', []);
  httpClient('C', ['/channels/shared']);
  send('B', '/channels/shared', {chunky: 'bacon'});
  checkInbox({
      A: {
        '/channels/shared': [{chunky: 'bacon'}]
      },
      B: {},
      C: {
        '/channels/shared': [{chunky: 'bacon'}]
      }
  });
}});

Scenario.run("Two HTTP clients, single wildcard on receiver",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/*']);
  httpClient('B', []);
  send('B', '/channels/anything', {msg: 'hey'});
  checkInbox({
      A: {
        '/channels/*': [{msg: 'hey'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, single wildcard on sender",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/name', '/channels/hello', '/channels/nested/hello']);
  httpClient('B', []);
  send('B', '/channels/*', {msg: 'hey'});
  checkInbox({
      A: {
        '/channels/name': [{msg: 'hey'}],
        '/channels/hello': [{msg: 'hey'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, single wildcard on both",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/*']);
  httpClient('B', []);
  send('B', '/channels/*', {msg: 'hey'});
  checkInbox({
      A: {
        '/channels/*': [{msg: 'hey'}]
      },
      B: {}
  });
}});

Scenario.run("Two local clients, double wildcard on sender",
function() { with(this) {
  server(8000);
  localClient('A', ['/channels/name', '/channels/hello', '/channels/nested/hello']);
  localClient('B', []);
  send('B', '/channels/**', {msg: 'hey'});
  checkInbox({
      A: {
        '/channels/name': [{msg: 'hey'}],
        '/channels/hello': [{msg: 'hey'}],
        '/channels/nested/hello': [{msg: 'hey'}]
      },
      B: {}
  });
}});

Scenario.run("Two local clients, one HTTP, double wildcard on sender and one subscription",
function() { with(this) {
  server(8000);
  localClient('A', ['/channels/hello', '/channels/nested/hello']);
  localClient('B', []);
  httpClient('C', ['/channels/name', '/channels/foo/**']);
  send('B', '/channels/**', {msg: 'hey'});
  checkInbox({
      A: {
        '/channels/hello': [{msg: 'hey'}],
        '/channels/nested/hello': [{msg: 'hey'}]
      },
      B: {},
      C: {
        '/channels/name': [{msg: 'hey'}],
        '/channels/foo/**': [{msg: 'hey'}],
        '/channels/name': [{msg: 'hey'}],
      }
  });
}});

