require "eventmachine"
require "faye/websocket"
require "fileutils"
require "json"
require "uri"

class InbucketMonitor
  RECONNECT_DELAY = 5
  READY_PATH = "/tmp/inbucket-monitor-ready".freeze

  class << self
    def run
      FileUtils.rm_f(READY_PATH)
      EventMachine.run { connect }
    end

    def record(payload)
      event = JSON.parse(payload)
      return unless event["variant"] == "message-stored"

      header = event["header"]
      return unless header.is_a?(Hash)

      Mailbox.record(header["mailbox"])
      MonitorMessage.record(header)
    rescue JSON::ParserError
      nil
    end

    private

    def connect
      socket = Faye::WebSocket::Client.new(monitor_url)
      socket.on(:open) { File.write(READY_PATH, "connected") }
      socket.on(:message) { |event| record(event.data) }
      socket.on(:close) do
        FileUtils.rm_f(READY_PATH)
        EventMachine.add_timer(RECONNECT_DELAY) { connect }
      end
    end

    def monitor_url
      base_url = URI(ENV.fetch("INBUCKET_BASE_URL"))
      base_url.scheme = base_url.scheme == "https" ? "wss" : "ws"
      base_url.path = "#{base_url.path.delete_suffix("/")}/api/v2/monitor/messages"
      base_url.query = nil
      base_url.to_s
    end
  end
end
