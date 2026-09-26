require "net/http"
require "uri"

class NtfyNotificationSender
  def initialize(delivery, delivery_method:, payload: nil)
    @delivery = delivery
    @delivery_method = delivery_method
    @payload = payload || NotificationEventPayload.new(delivery)
  end

  def deliver!
    response = perform_request
    raise "ntfy delivery failed" unless response.is_a?(Net::HTTPSuccess)
  end

  private

  def perform_request
    uri = URI.parse(@delivery_method.fetch("host"))
    uri.path = [uri.path.delete_suffix("/"), @delivery_method.fetch("topic")].reject(&:blank?).join("/").prepend("/")
    request = Net::HTTP::Post.new(uri)
    request["Title"] = @payload.title
    request["Click"] = @payload.message_url if @payload.message_url
    request["Content-Type"] = "text/plain; charset=utf-8"
    request.body = @payload.text
    http_request(uri, request)
  end

  def http_request(uri, request)
    Net::HTTP.start(
      uri.host,
      uri.port,
      use_ssl: uri.scheme == "https",
      open_timeout: 5,
      read_timeout: 5,
      write_timeout: 5
    ) { |connection| connection.request(request) }
  end
end
