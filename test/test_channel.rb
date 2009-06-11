require "test/unit"
require "faye"

class TestChannel < Test::Unit::TestCase
  include Faye
  
  def test_channel_storage
    tree = Channel::Tree.new
    tree['invalid/name']    = 1
    tree['/valid/name']     = 2
    tree['/va()$$lid/name'] = 3
    
    assert_equal nil, tree['invalid/name']
    assert_equal 2,   tree['/valid/name']
    assert_equal 3,   tree['/va()$$lid/name']
  end
  
  def test_globbing
    globber = Channel::Tree.new
    globber['/foo/bar']     = 1
    globber['/foo/boo']     = 2
    globber['/foo']         = 3
    globber['/foobar']      = 4
    globber['/foo/bar/boo'] = 5
    globber['/foobar/boo']  = 6
    globber['/foo/*']       = 7
    globber['/foo/**']      = 8
    
    assert_equal  [1,2,7,8],    globber.glob('/foo/*').sort
    assert_equal  [1,7,8],      globber.glob('/foo/bar').sort
    assert_equal  [1,2,5,7,8],  globber.glob('/foo/**').sort
    assert_equal  [5,8],        globber.glob('/foo/bar/boo').sort
  end
end
