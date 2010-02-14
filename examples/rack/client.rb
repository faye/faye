dir = File.dirname(__FILE__)
require dir + '/../../lib/faye'

app = Faye::RackAdapter.new(:mount => '/comet', :timeout => 25)

EM.run do
  client = app.get_client
  client.connect do
    client.subscribe '/from/jcoglan' do |message|
      p message['message']
    end
  end
  
  app.run 8000
end

