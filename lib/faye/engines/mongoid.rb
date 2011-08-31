require 'mongoid'
require 'em-mongo'

module Faye
  module Engine
    class Mongoid < Base

      def initialize(options)
        unless options[:mongoid_yaml] || options[:connection]
          raise ArgumentError, "Must provide either :mongoid_yaml or :connection option to the Mongoid engine."
        end

        @default_gc   = options[:default_gc] || 60
        @message_poll_timeout = options[:message_poll_timeout] || 1

        # Defer the rest of the init until after EM is available.
        EventMachine::next_tick do
          connect_to_mongodb(options)
          @gc = EventMachine.add_periodic_timer(@default_gc, &method(:gc))
          @empty_queue = EventMachine.add_periodic_timer(@message_poll_timeout, &method(:empty_queue))
        end

        super
      end

      def connect_to_mongodb(options)
        if options[:mongoid_yaml]
          ::Mongoid.load!(options[:mongoid_yaml])
        end
        if options[:connection]
          ::Mongoid.configure do |config|
            config.master = options[:connection]
          end
        end
      end

      def create_client(&callback)
        client = Models::Client.create
        until client.persisted?
          client = Models::Client.create
        end
        client_id = client.client_id
        debug "created new client ?", client_id
        callback.call client_id
      end

      def destroy_client(client_id, &callback)
        if client = find_client_by_client_id(client_id) && client.destroy
          debug 'Destroyed client ?', client_id
          callback.call if callback
        end
      end

      def client_exists(client_id, &callback)
        callback.call(!!find_client_by_client_id(client_id))
      end

      def ping(client_id)
        return unless Numeric === @timeout
        client = find_client_by_client_id(client_id)
        now = Time.now
        if client && (client.updated_at < now) && (client.updated_at = now) && client.save
          debug 'Ping ?, ?', client_id, @timeout
        end
      end

      def subscribe(client_id, channel_id, &callback)
        channel = find_or_create_channel_by_channel_id(channel_id)
        client = find_client_by_client_id(client_id)
        if channel && client
          channel.clients << client
          debug 'Subscribed client ? to channel ?', client_id, channel
          callback.call(true) if callback
        else
          callback.call(false) if callback
        end
      end

      def unsubscribe(client_id, channel_id, &callback)
        client = find_client_by_client_id(client_id)
        channel = find_channel_by_channel_id(channel_id)
        if client
          client.pull_all(:channel_ids, [ channel_id ])

          if channel
            channel.pull_all(:client_ids, [ client_id ])
          end

          # Pull the client from any messages for this channel.
          message.where(:channel_ids.in => channel_id, :client_ids.in => client_id).each do |message|
            message.pull_all(:client_ids, [ client_id ])
          end

          callback.call(true) if callback
        else
          callback.call(false) if callback
        end
      end

      def publish(message_hash)
        debug 'Publishing message ?', message_hash
        channel_ids = ::Faye::Channel.expand(message_hash['channel'])
        message = Models::Message.new(message: message_hash)
        with_lock "message_#{message.id.to_s}" do
          channels = Models::Channel.where(:channel_id.in => channel_ids).to_a
          clients = channels.map(&:clients).flatten.uniq
          message.channels = channels
          message.clients = clients
          if message.save
            # publish this message to our connected clients RSN
            EventMachine::defer do 
              tx_message message
            end
          end
        end
      end

      module Models

        class Client
          include ::Mongoid::Document
          include ::Mongoid::Timestamps
          store_in :faye_clients
          field :client_id, type: String, default: -> { Faye.random }
          key :client_id
          validates_uniqueness_of :client_id
          has_and_belongs_to_many :channels, class_name: '::Faye::Engine::Mongoid::Models::Channel'
        end

        class Channel
          include ::Mongoid::Document
          store_in :faye_channels
          field :channel_id, type: String
          key :channel_id
          validates_presence_of :channel_id
          validates_uniqueness_of :channel_id
          has_and_belongs_to_many :clients, class_name: '::Faye::Engine::Mongoid::Models::Client'
        end

        class Message
          include ::Mongoid::Document
          include ::Mongoid::Timestamps
          store_in :faye_messages
          field :message, type: Hash
          has_and_belongs_to_many :clients, inverse_of: nil, class_name: '::Faye::Engine::Mongoid::Models::Client', index: true
          has_and_belongs_to_many :channels, inverse_of: nil, class_name: '::Faye::Engine::Mongoid::Models::Channel', index: true
        end

        class Lock
          include ::Mongoid::Document
          store_in :faye_locks
          field :name
          validates_uniqueness_of :name
        end

      end

      private

      def find_client_by_client_id(client_id)
        Models::Client.where(client_id: client_id).first
      end

      def find_channel_by_channel_id(channel_id)
        Models::Channel.where(channel_id: channel_id).first
      end

      def find_or_create_channel_by_channel_id(channel_id)
        Models::Channel.where(channel_id: channel_id).first || Models::Channel.create(channel_id: channel_id)
      end

      def empty_queue(client_id=nil)
        # Find all messages which need to be delivered to any of our clients or the specified client.
        client_ids = client_id ? [ client_id ] : @connections.keys
        Models::Message.any_in(client_ids: client_ids).each do |message|
          tx_message(message)
        end
      end

      def tx_message(message)
        with_lock "message_#{message.id.to_s}" do
          all_recipients = message.client_ids
          # find the clients of this message attached to the current
          # instance.
          our_recipients = all_recipients & @connections.keys
          # remove our clients from the message's client list.
          remaining_recipients = message.pull_all(:client_ids, our_recipients)
          # deliver the message to all our clients
          @connections.values_at(*our_recipients).compact.each do |conn|
            conn.deliver(message.message)
          end
          # if the message has been delivered to all clients then delete
          # it from the db.
          if remaining_recipients.size == 0
            message.destroy
          end
        end
      end

      def with_lock(name, lock_timeout=0, &callback)
        yield
        #[0..lock_timeout].each do
        #  lock = Models::Lock.create(name: name)
        #  if lock.persisted?
        #    yield
        #    lock.destroy
        #  else
        #    sleep 1 if lock_timeout > 0
        #  end
        #end
      end

      def gc
        return unless Numeric === @timeout
        cutoff = Time.now.to_i - 2 * @timeout
        Models::Client.where(:updated_at.lt => cutoff).each do |client|
          # Remove this client from any messages.
          Models::Message.where(:client_ids.in => [ client.id ]).each do |message|
            with_lock "message_#{message.id.to_s}" do
              message.pull_all(:client_ids, [client.client_id])
            end
          end
          # Remove this client from any channels.
          Models::Channel.where(:client_ids.in => [ client.id ]).each do |channel|
            channel.pull_all(:client_ids, [client.id])
          end

          client.destroy
        end

        # Remove all messages with no remaining clients to deliver to.
        Models::Message.where(client_ids: []).each do |message|
          with_lock "message_#{message.id.to_s}" do
            message.destroy
          end
        end

        # Remove all channels with no remaining clients subscribed.
        Models::Channel.where(client_ids: []).each do |channel|
          channel.destroy
        end
      end

    end

    register 'mongoid', Mongoid
  end
end
