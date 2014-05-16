phantom.injectJs('node_modules/jstest/jstest.js')

var options  = {format: 'dot'},
    reporter = new JS.Test.Reporters.Headless(options)

reporter.open('spec/browser.html')
