# Contributing to Faye

To hack on Faye, you'll need Node in order to build both the gem and the npm
package. The following should get you up and running:

```bash
# Download the code from Git
git clone git://github.com/faye/faye.git
cd faye

# Install dependencies
bundle install
npm install

# Build Faye
npm run build

# Run tests
bundle exec rspec spec/
npm test
```
