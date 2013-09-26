# Contributing to Faye

To hack on Faye, you'll need Node in order to build both the gem and the npm
package. There are also a few submodules we use for testing. The following
should get you up and running:

```bash
# Download the code from Git
git clone git://github.com/faye/faye.git
cd faye
git submodule update --init --recursive

# Install dependencies
bundle install
npm install

# Build Faye
npm run-script build

# Run tests
bundle exec rspec -c spec/
node spec/node.js
```

