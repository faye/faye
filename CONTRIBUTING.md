# Contributing to Faye

Faye is implemented in both JavaScript and Ruby. You should be able to hack on
each implementation independently, although since both implementations include a
build of the JS client, you will need Node if you want to build the Ruby gem.

To get the code:

    git clone git://github.com/faye/faye.git
    cd faye

## Working on the JavaScript codebase

To install the dependencies (you will need to do this if you need to build the
Ruby gem as well):

    npm install

To run the tests on Node:

    npm test

To run the tests in the browser, you should run

    make test

which starts a process to continuously rebuild the source code and tests as you
edit them. Open `spec/index.html` to run the tests.

To build the package that we release to npm, run:

    make

## Working on the Ruby codebase

To install the dependencies:

    bundle install

To run the tests:

    bundle exec rspec

To build the gem (you will need to install the Node dependencies for this):

    make gem
