module V1
  class InbucketMonitorMessagesController < InbucketController
    def index
      messages = InbucketMessage.monitored.order(received_at: :desc, id: :desc).limit(200).to_a
      summaries = messages.map(&:rendered_summary)
      render json: summaries_with_stars(summaries)
    end

    private

    def summaries_with_stars(summaries)
      starred = StarredMessage.lookup(user: current_user, messages: summaries)
      summaries.map do |message|
        key = [message["mailbox"].to_s, message["id"].to_s]
        message.merge("starred" => starred.key?(key))
      end
    end
  end
end
