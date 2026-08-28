module V1
  class InbucketMonitorMessagesController < InbucketController
    def index
      messages = MonitorMessage.order(received_at: :desc, id: :desc).limit(200).to_a
      seen_states = seen_states_for(messages)
      return unless seen_states

      render json: messages.map { |message| monitor_message(message, seen_states) }
    end

    private

    def seen_states_for(messages)
      messages.group_by(&:mailbox).each_with_object({}) do |(mailbox, mailbox_messages), states|
        response = inbucket.mailbox(mailbox)
        unless response.status.between?(200, 299)
          render_upstream(response, json: true)
          return
        end
        raise InbucketClient::InvalidResponse unless response.body.is_a?(Array)

        headers = response.body.select { |header| header.is_a?(Hash) }.index_by { |header| header["id"].to_s }
        mailbox_messages.each do |message|
          states[[mailbox, message.message_id]] = headers.dig(message.message_id, "seen") == true
        end
      end
    end

    def monitor_message(message, seen_states)
      message.header.merge(
        "mailbox" => message.mailbox,
        "id" => message.message_id,
        "seen" => seen_states.fetch([message.mailbox, message.message_id])
      )
    end
  end
end
