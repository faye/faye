require "test/unit"
require File.dirname(__FILE__) + "/../lib/faye"
require "test/scenario"

class TestClients < Test::Unit::TestCase
  include Faye
  include Scenario
  
  scenario "Client modifies incoming messages" do
    server 8000
    http_client :A, ['/channels/a']
    http_client :B, ['/channels/b']
    
    extend_client :A, :incoming, lambda { |message, callback|
      message['data']['modified'] = 'hi'
      callback.call(message)
    }
    
    publish :B, '/channels/a', 'welcome' => 'message'
    check_inbox(
        :A => {
          '/channels/a' => ['welcome' => 'message', 'modified' => 'hi']
        },
        :B => {}
    )
  end
  
  scenario "Client blocks incoming messages" do
    server 8000
    http_client :A, ['/channels/a']
    http_client :B, ['/channels/b']
    
    extend_client :A, :incoming, lambda { |message, callback|
      callback.call(nil)
    }
    
    publish :B, '/channels/a', 'welcome' => 'message'
    check_inbox( :A => {}, :B => {} )
  end
  
  scenario "Server requires authentication" do
    server 8000
    http_client :A, ['/channels/a']
    http_client :B, ['/channels/b']
    
    extend_server :incoming, lambda { |message, callback|
      if message['ext'] and message['ext']['password']
        callback.call(message)
      end
    }
    
    extend_client :B, :outgoing, lambda { |message, callback|
      message['ext'] = {'password' => true}
      callback.call(message)
    }
    
    publish :A, '/channels/b', 'message_for' => 'B'
    check_inbox( :A => {}, :B => {} )
    
    publish :B, '/channels/a', 'message_for' => 'A'
    check_inbox(
        :A => {
          '/channels/a' => ['message_for' => 'A']
        },
        :B => {}
    )
  end
  
  scenario "Server modifies outgoing message" do
    server 8000
    http_client :A, []
    http_client :B, ['/channels/b']
    
    extend_server :outgoing, lambda { |message, callback|
      message['data']['addition'] = 56 if message['data']
      callback.call(message)
    }
    
    publish :A, '/channels/b', 'message_for' => 'B'
    check_inbox(
        :A => {},
        :B => {
          '/channels/b' => ['message_for' => 'B', 'addition' => 56]
        }
    )
  end
  
  scenario "Server blocks outgoing message" do
    server 8000
    http_client :A, []
    http_client :B, ['/channels/b']
    
    extend_server :outgoing, lambda { |message, callback|
      if !message['data'] or message['data']['deliver'] == 'yes'
        callback.call(message)
      else
        callback.call(nil)
      end
    }
    
    publish :A, '/channels/b', [{'deliver' => 'no'}, {'deliver' => 'yes'}]
    
    check_inbox(
        :A => {},
        :B => {
          '/channels/b' => ['deliver' => 'yes']
        }
    )
  end
  
  scenario "Two HTTP clients, no messages delivered" do
    server 8000
    http_client :A, ['/channels/a']
    http_client :B, []
    publish :B, '/channels/b', 'hello' => 'world'
    check_inbox(
      :A => {},
      :B => {}
    )
  end
  
  scenario "Two HTTP clients, single subscription" do
    server 8000
    http_client :A, ['/channels/a']
    http_client :B, []
    publish :B, '/channels/a', 'hello' => 'world'
    check_inbox(
        :A => {
          '/channels/a' => ['hello' => 'world']
        },
        :B => {}
    )
  end

  scenario "Two HTTP clients, multiple subscriptions" do
    server 8000
    http_client :A, ['/channels/a', '/channels/*']
    http_client :B, []
    publish :B, '/channels/a', 'hello' => 'world'
    check_inbox(
        :A => {
          '/channels/a' => ['hello' => 'world'],
          '/channels/*' => ['hello' => 'world']
        },
        :B => {}
    )
  end

  scenario "Three HTTP clients, single receiver" do
    server 8000
    http_client :A, ['/channels/a']
    http_client :B, []
    http_client :C, ['/channels/c']
    publish :B, '/channels/a', 'chunky' => 'bacon'
    check_inbox(
        :A => {
          '/channels/a' => ['chunky' => 'bacon']
        },
        :B => {},
        :C => {}
    )
  end

  scenario "Three HTTP clients, multiple receivers" do
    server 8000
    http_client :A, ['/channels/shared']
    http_client :B, []
    http_client :C, ['/channels/shared']
    publish :B, '/channels/shared', 'chunky' => 'bacon'
    check_inbox(
        :A => {
          '/channels/shared' => ['chunky' => 'bacon']
        },
        :B => {},
        :C => {
          '/channels/shared' => ['chunky' => 'bacon']
        }
    )
  end

  scenario "Two HTTP clients, single wildcard on receiver" do
    server 8000
    http_client :A, ['/channels/*']
    http_client :B, []
    publish :B, '/channels/anything', 'msg' => 'hey'
    check_inbox(
        :A => {
          '/channels/*' => ['msg' => 'hey']
        },
        :B => {}
    )
  end

  scenario "Two HTTP clients, single wildcard on sender" do
    server 8000
    http_client :A, ['/channels/name', '/channels/hello', '/channels/nested/hello']
    http_client :B, []
    publish :B, '/channels/*', 'msg' => 'hey'
    check_inbox(
        :A => {
          '/channels/name' => ['msg' => 'hey'],
          '/channels/hello' => ['msg' => 'hey']
        },
        :B => {}
    )
  end

  scenario "Two HTTP clients, single wildcard on both" do
    server 8000
    http_client :A, ['/channels/*']
    http_client :B, []
    publish :B, '/channels/*', 'msg' => 'hey'
    check_inbox(
        :A => {
          '/channels/*' => ['msg' => 'hey']
        },
        :B => {}
    )
  end

  scenario "Two local clients, double wildcard on sender" do
    server 8000
    local_client :A, ['/channels/name', '/channels/hello', '/channels/nested/hello']
    local_client :B, []
    publish :B, '/channels/**', 'msg' => 'hey'
    check_inbox(
        :A => {
          '/channels/name' => ['msg' => 'hey'],
          '/channels/hello' => ['msg' => 'hey'],
          '/channels/nested/hello' => ['msg' => 'hey']
        },
        :B => {}
    )
  end

  scenario "Two local clients, one HTTP, double wildcard on sender and one subscription" do
    server 8000
    local_client :A, ['/channels/hello', '/channels/nested/hello']
    local_client :B, []
    http_client :C, ['/channels/name', '/channels/foo/**']
    publish :B, '/channels/**', 'msg' => 'hey'
    check_inbox(
        :A => {
          '/channels/hello' => ['msg' => 'hey'],
          '/channels/nested/hello' => ['msg' => 'hey']
        },
        :B => {},
        :C => {
          '/channels/name' => ['msg' => 'hey'],
          '/channels/foo/**' => ['msg' => 'hey'],
          '/channels/name' => ['msg' => 'hey'],
        }
    )
  end
end

