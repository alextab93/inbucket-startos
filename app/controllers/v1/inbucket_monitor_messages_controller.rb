module V1
  class InbucketMonitorMessagesController < InbucketController
    def index
      messages = MonitorMessage.order(received_at: :desc, id: :desc).limit(200).map do |message|
        message.header.merge("mailbox" => message.mailbox, "id" => message.message_id)
      end
      render json: messages
    end
  end
end
