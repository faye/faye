require "spec_helper"

describe Faye::Publisher do
  let(:publisher) { Class.new { include Faye::Publisher }.new }

  describe "with subscribers that remove themselves" do
    before do
      @called_a = false
      @called_b = false

      handler = lambda do
        @called_a = true
        publisher.unbind(:event, &handler)
      end

      publisher.bind(:event, &handler)
      publisher.bind(:event) { @called_b = true }
    end

    it "successfully calls all the callbacks" do
      publisher.trigger(:event)
      @called_a.should == true
      @called_b.should == true
    end
  end
end
