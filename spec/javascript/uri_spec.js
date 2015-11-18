var jstest = require("jstest").Test

var URI = require("../../javascript/util/uri")

jstest.describe("URI", function() { with(this) {
  describe("parse", function() { with(this) {
    it("parses all the bits of a URI", function() { with(this) {
      assertEqual( {
          href:     "http://example.com:80/foo.html?foo=bar&hello=%2Fworld#cloud",
          protocol: "http:",
          host:     "example.com:80",
          hostname: "example.com",
          port:     "80",
          path:     "/foo.html?foo=bar&hello=%2Fworld",
          pathname: "/foo.html",
          search:   "?foo=bar&hello=%2Fworld",
          query:    { foo: "bar", hello: "/world" },
          hash:     "#cloud"
        }, URI.parse("http://example.com:80/foo.html?foo=bar&hello=%2Fworld#cloud") )
    }})

    it("parses a URI with no hash", function() { with(this) {
      assertEqual( {
          href:     "http://example.com:80/foo.html?foo=bar&hello=%2Fworld",
          protocol: "http:",
          host:     "example.com:80",
          hostname: "example.com",
          port:     "80",
          path:     "/foo.html?foo=bar&hello=%2Fworld",
          pathname: "/foo.html",
          search:   "?foo=bar&hello=%2Fworld",
          query:    { foo: "bar", hello: "/world" },
          hash:     ""
        }, URI.parse("http://example.com:80/foo.html?foo=bar&hello=%2Fworld") )
    }})

    it("parses a URI with no query", function() { with(this) {
      assertEqual( {
          href:     "http://example.com:80/foo.html#cloud",
          protocol: "http:",
          host:     "example.com:80",
          hostname: "example.com",
          port:     "80",
          path:     "/foo.html",
          pathname: "/foo.html",
          search:   "",
          query:    {},
          hash:     "#cloud"
        }, URI.parse("http://example.com:80/foo.html#cloud") )
    }})

    it("parses a URI with an encoded path", function() { with(this) {
      assertEqual( {
          href:     "http://example.com:80/fo%20o.html?foo=bar&hello=%2Fworld#cloud",
          protocol: "http:",
          host:     "example.com:80",
          hostname: "example.com",
          port:     "80",
          path:     "/fo%20o.html?foo=bar&hello=%2Fworld",
          pathname: "/fo%20o.html",
          search:   "?foo=bar&hello=%2Fworld",
          query:    { foo: "bar", hello: "/world" },
          hash:     "#cloud"
        }, URI.parse("http://example.com:80/fo%20o.html?foo=bar&hello=%2Fworld#cloud") )
    }})

    it("parses a URI with no path", function() { with(this) {
      assertEqual( {
          href:     "http://example.com:80/?foo=bar&hello=%2Fworld#cloud",
          protocol: "http:",
          host:     "example.com:80",
          hostname: "example.com",
          port:     "80",
          path:     "/?foo=bar&hello=%2Fworld",
          pathname: "/",
          search:   "?foo=bar&hello=%2Fworld",
          query:    { foo: "bar", hello: "/world" },
          hash:     "#cloud"
        }, URI.parse("http://example.com:80?foo=bar&hello=%2Fworld#cloud") )
    }})

    it("parses a URI with no port", function() { with(this) {
      assertEqual( {
          href:     "http://example.com/foo.html?foo=bar&hello=%2Fworld#cloud",
          protocol: "http:",
          host:     "example.com",
          hostname: "example.com",
          port:     "",
          path:     "/foo.html?foo=bar&hello=%2Fworld",
          pathname: "/foo.html",
          search:   "?foo=bar&hello=%2Fworld",
          query:    { foo: "bar", hello: "/world" },
          hash:     "#cloud"
        }, URI.parse("http://example.com/foo.html?foo=bar&hello=%2Fworld#cloud") )
    }})
  }})
}})
