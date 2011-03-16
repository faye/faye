require "spec_helper"

describe Faye do
  describe :random do
    it "returns a 128-bit random number in base 36" do
      Faye.random.should =~ /^[a-z0-9]+$/
    end
    
    it "always produces the same length of string" do
      ids = (1..100).map { Faye.random }
      ids.should be_all { |id| id.size == 25 }
    end
  end
end
