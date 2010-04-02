require "test/unit"
require File.dirname(__FILE__) + "/../lib/faye"
require "test/scenario"

class TestClients < Test::Unit::TestCase
  include Faye
  include Scenario
  
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

