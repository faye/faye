require "test/unit"
require "faye"

class TestFaye < Test::Unit::TestCase
  include Faye
  
  def test_grammar
    assert Grammar::LOWALPHA =~ 'a'
    assert Grammar::LOWALPHA !~ 'A'
    assert Grammar::LOWALPHA !~ 'aa'
    
    assert Grammar::UPALPHA !~ 'a'
    assert Grammar::UPALPHA =~ 'A'
    assert Grammar::UPALPHA !~ 'AA'
    
    assert Grammar::ALPHA =~ 'a'
    assert Grammar::ALPHA =~ 'A'
    assert Grammar::ALPHA !~ '0'
    assert Grammar::ALPHA !~ 'aA'
    
    assert Grammar::DIGIT =~ '0'
    assert Grammar::DIGIT !~ '90'
    assert Grammar::DIGIT !~ 'z'
    
    assert Grammar::ALPHANUM =~ '6'
    assert Grammar::ALPHANUM =~ 'b'
    assert Grammar::ALPHANUM !~ '6b'
    assert Grammar::ALPHANUM !~ '/'
    
    assert Grammar::MARK =~ '-'
    assert Grammar::MARK =~ '@'
    assert Grammar::MARK !~ '!-'
    
    assert Grammar::STRING =~ ''
    assert Grammar::STRING =~ ' 4tv4 (($ !/~ ..* /) ___'
    assert Grammar::STRING !~ ' 4tv4 (($ !/~ ..* /) _}_'
    
    assert Grammar::TOKEN =~ '$a9b'
    assert Grammar::TOKEN !~ ''
    
    assert Grammar::INTEGER =~ '9'
    assert Grammar::INTEGER =~ '09'
    assert Grammar::INTEGER !~ '9.0'
    assert Grammar::INTEGER !~ '9a'
    
    assert Grammar::CHANNEL_NAME =~ '/fo_o/$@()bar'
    assert Grammar::CHANNEL_NAME !~ '/foo/$@()bar/'
    assert Grammar::CHANNEL_NAME !~ 'foo/$@()bar'
    assert Grammar::CHANNEL_NAME !~ '/fo o/$@()bar'
    
    assert Grammar::CHANNEL_PATTERN =~ '/!!/$/*'
    assert Grammar::CHANNEL_PATTERN =~ '/!!/$/**'
    assert Grammar::CHANNEL_PATTERN !~ '/!!/$/**/'
    assert Grammar::CHANNEL_PATTERN !~ '!!/$/**'
    assert Grammar::CHANNEL_PATTERN !~ '/!!/$/**/*'
    
    assert Grammar::VERSION =~ '9'
    assert Grammar::VERSION =~ '9.a-delta4'
    assert Grammar::VERSION !~ '9.a-delta4.'
    assert Grammar::VERSION !~ 'K.a-delta4'
    
    assert Grammar::CLIENT_ID =~ '9'
    assert Grammar::CLIENT_ID =~ 'j'
    assert Grammar::CLIENT_ID !~ ''
    assert Grammar::CLIENT_ID =~ 'dfghs5r'
    assert Grammar::CLIENT_ID !~ 'dfg_hs5r'
    
    assert Grammar::ERROR =~ '401::No client ID'
    assert Grammar::ERROR !~ '401:No client ID'
    assert Grammar::ERROR !~ '40::No client ID'
    assert Grammar::ERROR !~ '40k::No client ID'
    assert Grammar::ERROR =~ '402:xj3sjdsjdsjad:Unknown Client ID'
    assert Grammar::ERROR =~ '403:xj3sjdsjdsjad,/foo/bar:Subscription denied'
    assert Grammar::ERROR =~ '404:/foo/bar:Unknown Channel'
  end
  
  def test_channel_tree
    tree = Channel::Tree.new
    
    tree['invalid/name'] = 1
    assert_equal nil, tree['invalid/name']
    
    tree['/valid/name'] = 2
    assert_equal 2, tree['/valid/name']
    
    tree['/va()$$lid/name'] = 3
    assert_equal 3, tree['/va()$$lid/name']
  end
end
