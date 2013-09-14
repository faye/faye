require "spec_helper"

describe Faye do
  describe :random do
    it "returns a 160-bit random number in base 36" do
      Faye.random.should =~ /^[a-z0-9]+$/
    end

    it "always produces the same length of string" do
      ids = (1..100).map { Faye.random }
      ids.should be_all { |id| id.size == 31 }
    end
  end

  describe :copy_obect do
    let(:object) { {"foo" => "bar", "qux" => 42, "hey" => nil, "obj" => {"bar" => 67}} }

    it "returns an equal object" do
      Faye.copy_object(object).should == {"foo" => "bar", "qux" => 42, "hey" => nil, "obj" => {"bar" => 67}}
    end

    it "does not return the same object" do
      Faye.copy_object(object).should_not be_equal(object)
    end

    it "performs a deep clone" do
      Faye.copy_object(object)["obj"].should_not be_equal(object["obj"])
    end
  end
end
