// This script should be run with PhantomJS
// http://www.phantomjs.org/

var page = new WebPage()

page.onConsoleMessage = function(message) {
  try {
    var result = JSON.parse(message)
    if ('total' in result && 'fail' in result) {
      console.log(message)
      var status = (!result.fail && !result.error) ? 0 : 1
      phantom.exit(status)
    }
  } catch (e) {}
}

page.open('spec/browser.html')
