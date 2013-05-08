require "spec_helper"

describe Faye::Grammar do
  describe :CHANNEL_NAME do
    it "matches valid channel names" do
      Faye::Grammar::CHANNEL_NAME.should =~ "/fo_o/$@()bar"
    end

    it "does not match channel patterns" do
      Faye::Grammar::CHANNEL_NAME.should_not =~ "/foo/**"
    end

    it "does not match invalid channel names" do
      Faye::Grammar::CHANNEL_NAME.should_not =~ "foo/$@()bar"
      Faye::Grammar::CHANNEL_NAME.should_not =~ "/foo/$@()bar/"
      Faye::Grammar::CHANNEL_NAME.should_not =~ "/fo o/$@()bar"
    end
  end

  describe :CHANNEL_PATTERN do
    it "does not match channel names" do
      Faye::Grammar::CHANNEL_PATTERN.should_not =~ "/fo_o/$@()bar"
    end

    it "matches valid channel patterns" do
      Faye::Grammar::CHANNEL_PATTERN.should =~ "/foo/**"
      Faye::Grammar::CHANNEL_PATTERN.should =~ "/foo/*"
    end

    it "does not match invalid channel patterns" do
      Faye::Grammar::CHANNEL_PATTERN.should_not =~ "/foo/**/*"
    end
  end

  describe :ERROR do
    it "matches an error with an argument" do
      Faye::Grammar::ERROR.should =~ "402:xj3sjdsjdsjad:Unknown Client ID"
    end

    it "matches an error with many arguments" do
      Faye::Grammar::ERROR.should =~ "403:xj3sjdsjdsjad,/foo/bar:Subscription denied"
    end

    it "matches an error with no arguments" do
      Faye::Grammar::ERROR.should =~ "402::Unknown Client ID"
    end

    it "does not match an error with no code" do
      Faye::Grammar::ERROR.should_not =~ ":xj3sjdsjdsjad:Unknown Client ID"
    end

    it "does not match an error with an invalid code" do
      Faye::Grammar::ERROR.should_not =~ "40:xj3sjdsjdsjad:Unknown Client ID"
    end
  end

  describe :VERSION do
    it "matches a version number" do
      Faye::Grammar::VERSION.should =~ "9"
      Faye::Grammar::VERSION.should =~ "9.0.a-delta1"
    end

    it "does not match invalid version numbers" do
      Faye::Grammar::VERSION.should_not =~ "9.0.a-delta1."
      Faye::Grammar::VERSION.should_not =~ ""
    end
  end
end
