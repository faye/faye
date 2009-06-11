require "test/unit"
require "faye"

class TestServer < Test::Unit::TestCase
  include Faye
  
  def setup
    @server = Server.new
  end
  
  def method_missing(*args, &block)
    @r = @server.__send__(*args, &block)
  end
  
  def test_handshake
    # MUST
    handshake(  'version' => '1.0',
                'supportedConnectionTypes' => %w[long-polling] )
    # MAY include minimumVersion, ext, id
    # SHOULD NOT send other messages with handshake
    
    # MUST
    assert_equal  '/meta/handshake',                  @r['channel']
    assert_not_nil                                    @r['version']
    assert_equal  %w[long-polling callback-polling],  @r['supportedConnectionTypes']
    assert_match  /[a-z0-9]+/,                        @r['clientId']
    assert_equal  true,                               @r['successful']
    # MAY
    assert_nil                                        @r['id']
    # MAY include minimumVersion, advice, ext, authSuccessful
    
    handshake(  'version' => '1.0',
                'supportedConnectionTypes' => %w[long-polling],
                'id' => 'foo' )
    # MAY
    assert_equal 'foo', @r['id']
    
    # Unique IDs
    id = @r['clientId']
    handshake(  'version' => '1.0',
                'supportedConnectionTypes' => %w[callback-polling] )
    assert_not_equal  id, @r['clientId']
    
    # missing version
    handshake('supportedConnectionTypes' => %w[long-polling])
    # MUST
    assert_equal  '/meta/handshake',      @r['channel']
    assert_equal  false,                  @r['successful']
    assert_equal  '300::Missing version', @r['error']
    # MAY
    assert_not_nil                                    @r['version']
    assert_equal  %w[long-polling callback-polling],  @r['supportedConnectionTypes']
    # advice, minimumVersion, ext, id
    
    # no matching connection type
    handshake('supportedConnectionTypes' => %w[iframe flash])
    # MUST
    assert_equal  '/meta/handshake',      @r['channel']
    assert_equal  false,                  @r['successful']
    assert_equal  '301::Server does not support connection types {iframe, flash}', @r['error']
    # MAY
    assert_equal  %w[long-polling callback-polling],  @r['supportedConnectionTypes']
    assert_nil                            @r['id']
    
    # no given connection type
    handshake('version' => '1.0', 'id' => 'foo')
    # MUST
    assert_equal  '/meta/handshake',      @r['channel']
    assert_equal  false,                  @r['successful']
    assert_equal  '301::Missing supportedConnectionTypes', @r['error']
    # MAY
    assert_equal  %w[long-polling callback-polling],  @r['supportedConnectionTypes']
    assert_equal  'foo',                  @r['id']
  end
end
