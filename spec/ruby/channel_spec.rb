require "spec_helper"

describe Faye::Channel do
  describe :expand do
    it "returns all patterns that match a channel" do
      Faye::Channel.expand("/foo").should == [
                           "/**", "/foo", "/*"]

      Faye::Channel.expand("/foo/bar").should == [
                           "/**", "/foo/bar", "/foo/*", "/foo/**"]

      Faye::Channel.expand("/foo/bar/qux").should == [
                           "/**", "/foo/bar/qux", "/foo/bar/*", "/foo/**", "/foo/bar/**"]
    end
  end
end
