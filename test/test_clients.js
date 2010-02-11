var Scenario = require('./scenario'),
    faye = require('../build/faye');

Scenario.run("Two HTTP clients, no messages delivered",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  send('B', '/channels/b', {hello: 'world'}, {
      A: {},
      B: {}
  });
}});

Scenario.run("Two HTTP clients, single subscription",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  send('B', '/channels/a', {hello: 'world'}, {
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
  send('B', '/channels/a', {hello: 'world'}, {
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
  send('B', '/channels/a', {chunky: 'bacon'}, {
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
  send('B', '/channels/shared', {chunky: 'bacon'}, {
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
  send('B', '/channels/anything', {msg: 'hey'}, {
      A: {
        '/channels/*': [{msg: 'hey'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, single wildcard on sender",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/name']);
  httpClient('B', []);
  send('B', '/channels/*', {msg: 'hey'}, {
      A: {
        '/channels/name': [{msg: 'hey'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, single wildcard on both",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/*']);
  httpClient('B', []);
  send('B', '/channels/*', {msg: 'hey'}, {
      A: {
        '/channels/*': [{msg: 'hey'}]
      },
      B: {}
  });
}});

