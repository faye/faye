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

  describe Faye::Channel::Set do
    describe :subscribe do
      it "subscribes and unsubscribes without callback" do
        channels = Faye::Channel::Set.new
        channels.subscribe(["/foo/**"], nil)
        channels.keys.should == ["/foo/**"]
        channels.unsubscribe("/foo/**", nil).should == true
      end
    end
  end
end
