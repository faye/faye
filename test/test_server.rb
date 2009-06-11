require "test/unit"
require "faye"

class TestServer < Test::Unit::TestCase
  include Faye
  
  def setup
    @server = Server.new
  end
  
  def teardown
    @server.destroy!
  end
  
  def get_client_id
    handshake(  'version' => '1.0',
                'supportedConnectionTypes' => %w[long-polling] )
    @r['clientId']
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
    assert_not_equal  nil,                            @r['version']
    assert_equal  %w[long-polling callback-polling],  @r['supportedConnectionTypes']
    assert_match  /[a-z0-9]+/,                        @r['clientId']
    assert_equal  true,                               @r['successful']
    # MAY
    assert_equal  nil,                                @r['id']
    # MAY include minimumVersion, advice, ext, authSuccessful
    
    # Unique IDs
    id1 = @r['clientId']
    assert_equal [id1], @server.client_ids
    handshake( 'version' => '1.0', 'supportedConnectionTypes' => %w[callback-polling] )
    id2 = @r['clientId']
    assert_not_equal id1, id2
    assert_equal [id1, id2].sort, @server.client_ids.sort
    
    handshake(  'version' => '1.0',
                'supportedConnectionTypes' => %w[long-polling],
                'id' => 'foo' )
    # MAY
    assert_equal 'foo', @r['id']
    
    # missing version
    handshake('supportedConnectionTypes' => %w[long-polling])
    # MUST
    assert_equal  '/meta/handshake',      @r['channel']
    assert_equal  false,                  @r['successful']
    assert_equal  '402::Missing version', @r['error']
    # MAY
    assert_not_equal  nil,                            @r['version']
    assert_equal  %w[long-polling callback-polling],  @r['supportedConnectionTypes']
    # MAY include advice, minimumVersion, ext, id
    
    # no matching connection type
    handshake('supportedConnectionTypes' => %w[iframe flash])
    # MUST
    assert_equal  '/meta/handshake',      @r['channel']
    assert_equal  false,                  @r['successful']
    assert_equal  '301::Server does not support connection types {iframe, flash}', @r['error']
    # MAY
    assert_equal  %w[long-polling callback-polling],  @r['supportedConnectionTypes']
    assert_equal  nil,                    @r['id']
    
    # no given connection type
    handshake('version' => '1.0', 'id' => 'foo')
    # MUST
    assert_equal  '/meta/handshake',      @r['channel']
    assert_equal  false,                  @r['successful']
    assert_equal  '402::Missing supportedConnectionTypes', @r['error']
    # MAY
    assert_equal  %w[long-polling callback-polling],  @r['supportedConnectionTypes']
    assert_equal  'foo',                  @r['id']
  end
  
  def test_connect
    id = get_client_id
    # MUST
    connect(  'clientId'        => id,
              'connectionType'  => 'long-polling' ) do |ev|
      @r = ev.first
      # MUST
      assert_equal  '/meta/connect',    @r['channel']
      assert_equal  true,               @r['successful']
      assert_equal  id,                 @r['clientId']
      # MAY
      assert_equal  nil,                @r['id']
      # MAY include error, advice, ext, timestamp
    end
    
    connect(  'clientId'        => id,
              'connectionType'  => 'long-polling',
              'id'              => 'foo' ) do |ev|
      @r = ev.first
      # MUST
      assert_equal  '/meta/connect',    @r['channel']
      assert_equal  true,               @r['successful']
      assert_equal  id,                 @r['clientId']
      # MAY
      assert_equal  'foo',              @r['id']
    end
    
    # no client ID
    connect(  'connectionType'  => 'long-polling' ) do |ev|
      @r = ev.first
      # MUST
      assert_equal  '/meta/connect',    @r['channel']
      assert_equal  false,              @r['successful']
      assert_equal  nil,                @r['clientId']
      # MAY
      assert_equal  '402::Missing clientId', @r['error']
      assert_equal  nil,                @r['id']
      # MAY include advice, ext, timestamp
    end
    
    # no connection type
    connect(  'clientId'  => id ) do |ev|
      @r = ev.first
      # MUST
      assert_equal  '/meta/connect',    @r['channel']
      assert_equal  false,              @r['successful']
      assert_equal  nil,                @r['clientId']
      # MAY
      assert_equal  '402::Missing connectionType', @r['error']
      assert_equal  nil,                @r['id']
      # MAY include advice, ext, timestamp
    end
  end
  
  def test_disconnect
    id = get_client_id
    assert_equal  [id], @server.client_ids
    
    # MUST
    disconnect( 'clientId' => id )
    # MUST
    assert_equal  '/meta/disconnect',   @r['channel']
    assert_equal  id,                   @r['clientId']
    assert_equal  true,                 @r['successful']
    # MAY
    assert_equal  nil,                  @r['id']
    # MAY include error, ext
    assert_equal  [], @server.client_ids
    
    # missing client ID
    disconnect( 'id' => 'foo' )
    # MUST
    assert_equal  '/meta/disconnect',   @r['channel']
    assert_equal  nil,                  @r['clientId']
    assert_equal  false,                @r['successful']
    # MAY
    assert_equal  '402::Missing clientId', @r['error']
    assert_equal  'foo',                @r['id']
    # MAY include ext
    
    # unrecognised client ID
    disconnect( 'clientId' => id )
    # MUST
    assert_equal  '/meta/disconnect',   @r['channel']
    assert_equal  nil,                  @r['clientId']
    assert_equal  false,                @r['successful']
    # MAY
    assert_equal  "401::Unknown client ID #{id}", @r['error']
    assert_equal  nil,                  @r['id']
    # MAY include ext
  end
end
