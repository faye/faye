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
    tree = Channel::Tree.new
    tree['/foo/bar']     = 1
    tree['/foo/boo']     = 2
    tree['/foo']         = 3
    tree['/foobar']      = 4
    tree['/foo/bar/boo'] = 5
    tree['/foobar/boo']  = 6
    tree['/foo/*']       = 7
    tree['/foo/**']      = 8
    
    assert_equal  [1,2,7,8],    tree.glob('/foo/*').sort
    assert_equal  [1,7,8],      tree.glob('/foo/bar').sort
    assert_equal  [1,2,5,7,8],  tree.glob('/foo/**').sort
    assert_equal  [5,8],        tree.glob('/foo/bar/boo').sort
    
    tree['/channels/hello'] = 'A'
    tree['/channels/name'] = 'B'
    tree['/channels/nested/hello'] = 'C'
    
    assert_equal %w[A B C],     tree.glob('/channels/**').sort
  end
end
