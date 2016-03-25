var jstest = require("jstest").Test

var Grammar = require("../../javascript/protocol/grammar")

jstest.describe("Grammar", function() { with(this) {
  describe("CHANNEL_NAME", function() { with(this) {
    it("matches valid channel names", function() { with(this) {
      assertMatch( Grammar.CHANNEL_NAME, "/fo_o/$@()bar" )
    }})

    it("does not match channel patterns", function() { with(this) {
      assertNoMatch( Grammar.CHANNEL_NAME, "/foo/**" )
    }})

    it("does not match invalid channel names", function() { with(this) {
      assertNoMatch( Grammar.CHANNEL_NAME, "foo/$@()bar" )
      assertNoMatch( Grammar.CHANNEL_NAME, "/foo/$@()bar/" )
      assertNoMatch( Grammar.CHANNEL_NAME, "/fo o/$@()bar" )
    }})
  }})

  describe("CHANNEL_PATTERN", function() { with(this) {
    it("does not match channel names", function() { with(this) {
      assertNoMatch( Grammar.CHANNEL_PATTERN, "/fo_o/$@()bar" )
    }})

    it("matches valid channel patterns", function() { with(this) {
      assertMatch( Grammar.CHANNEL_PATTERN, "/foo/**" )
      assertMatch( Grammar.CHANNEL_PATTERN, "/foo/*" )
    }})

    it("does not match invalid channel patterns", function() { with(this) {
      assertNoMatch( Grammar.CHANNEL_PATTERN, "/foo/**/*" )
    }})
  }})

  describe("ERROR", function() { with(this) {
    it("matches an error with an argument", function() { with(this) {
      assertMatch( Grammar.ERROR, "402:xj3sjdsjdsjad:Unknown Client ID" )
    }})

    it("matches an error with many arguments", function() { with(this) {
      assertMatch( Grammar.ERROR, "403:xj3sjdsjdsjad,/foo/bar:Subscription denied" )
    }})

    it("matches an error with no arguments", function() { with(this) {
      assertMatch( Grammar.ERROR, "402::Unknown Client ID" )
    }})

    it("does not match an error with no code", function() { with(this) {
      assertNoMatch( Grammar.ERROR, ":xj3sjdsjdsjad:Unknown Client ID" )
    }})

    it("does not match an error with an invalid code", function() { with(this) {
      assertNoMatch( Grammar.ERROR, "40:xj3sjdsjdsjad:Unknown Client ID" )
    }})
  }})

  describe("VERSION", function() { with(this) {
    it("matches a version number", function() { with(this) {
      assertMatch( Grammar.VERSION, "9" )
      assertMatch( Grammar.VERSION, "9.0.a-delta1" )
    }})

    it("does not match invalid version numbers", function() { with(this) {
      assertNoMatch( Grammar.VERSION, "9.0.a-delta1." )
      assertNoMatch( Grammar.VERSION, "" )
    }})
  }})
}})
