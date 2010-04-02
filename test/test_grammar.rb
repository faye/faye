require "test/unit"
require File.dirname(__FILE__) + "/../lib/faye"

class TestGrammar < Test::Unit::TestCase
  include Faye::Grammar
  
  def test_single_chars
    assert LOWALPHA =~ 'a'
    assert LOWALPHA !~ 'A'
    assert LOWALPHA !~ 'aa'
    
    assert UPALPHA !~ 'a'
    assert UPALPHA =~ 'A'
    assert UPALPHA !~ 'AA'
    
    assert ALPHA =~ 'a'
    assert ALPHA =~ 'A'
    assert ALPHA !~ '0'
    assert ALPHA !~ 'aA'
    
    assert DIGIT =~ '0'
    assert DIGIT !~ '90'
    assert DIGIT !~ 'z'
    
    assert ALPHANUM =~ '6'
    assert ALPHANUM =~ 'b'
    assert ALPHANUM !~ '6b'
    assert ALPHANUM !~ '/'
    
    assert MARK =~ '-'
    assert MARK =~ '@'
    assert MARK !~ '!-'
  end
  
  def test_strings
    assert STRING =~ ''
    assert STRING =~ ' 4tv4 (($ !/~ ..* /) ___'
    assert STRING !~ ' 4tv4 (($ !/~ ..* /) _}_'
    
    assert TOKEN =~ '$a9b'
    assert TOKEN !~ ''
    
    assert INTEGER =~ '9'
    assert INTEGER =~ '09'
    assert INTEGER !~ '9.0'
    assert INTEGER !~ '9a'
  end
  
  def test_channels
    assert CHANNEL_NAME =~ '/fo_o/$@()bar'
    assert CHANNEL_NAME !~ '/foo/$@()bar/'
    assert CHANNEL_NAME !~ 'foo/$@()bar'
    assert CHANNEL_NAME !~ '/fo o/$@()bar'
    
    assert CHANNEL_PATTERN =~ '/!!/$/*'
    assert CHANNEL_PATTERN =~ '/!!/$/**'
    assert CHANNEL_PATTERN !~ '/!!/$/**/'
    assert CHANNEL_PATTERN !~ '!!/$/**'
    assert CHANNEL_PATTERN !~ '/!!/$/**/*'
  end
  
  def test_version
    assert VERSION =~ '9'
    assert VERSION =~ '9.a-delta4'
    assert VERSION !~ '9.a-delta4.'
    assert VERSION !~ 'K.a-delta4'
  end
  
  def test_ids
    assert CLIENT_ID =~ '9'
    assert CLIENT_ID =~ 'j'
    assert CLIENT_ID !~ ''
    assert CLIENT_ID =~ 'dfghs5r'
    assert CLIENT_ID !~ 'dfg_hs5r'
  end
  
  def test_errors
    assert ERROR =~ '401::No client ID'
    assert ERROR !~ '401:No client ID'
    assert ERROR !~ '40::No client ID'
    assert ERROR !~ '40k::No client ID'
    assert ERROR =~ '402:xj3sjdsjdsjad:Unknown Client ID'
    assert ERROR =~ '403:xj3sjdsjdsjad,/foo/bar:Subscription denied'
    assert ERROR =~ '404:/foo/bar:Unknown Channel'
  end
end
