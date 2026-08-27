module V1
  class InbucketMailboxesController < InbucketController
    def index
      mailboxes = Mailbox.archived.order(:name)
      return render json: Mailbox.active.order(:name).pluck(:name) unless params[:archived] == "true"

      render json: mailboxes.map { |mailbox| archived_mailbox(mailbox) }
    end

    def show
      name = params.require(:name)
      Mailbox.find_by(name: name)&.update!(archived: false)
      upstream = inbucket.mailbox(name)
      return render_upstream(upstream, json: true) unless mailbox_response?(upstream)

      Mailbox.record(name) if upstream.body.any?
      render json: messages_with_read_status(name, upstream.body), status: upstream.status
    end

    def destroy
      name = params.require(:name)
      upstream = inbucket.purge_mailbox(name)
      if upstream.status.between?(200, 299)
        Mailbox.where(name: name).destroy_all
        MonitorMessage.where(mailbox: name).destroy_all
        MessageRead.where(mailbox: name).destroy_all
      end
      render_destroy_upstream(upstream)
    end

    def archive
      mailbox = Mailbox.find_by!(name: params.require(:name))
      mailbox.update!(archived: params[:archived] != "false")
      head :no_content
    end

    private

    def mailbox_response?(response)
      response.status.between?(200, 299) && response.body.is_a?(Array)
    end

    def messages_with_read_status(mailbox, messages)
      read_ids = MessageRead.where(user: current_user_session.user, mailbox:).pluck(:message_id).index_with(true)
      messages.map do |message|
        id = message["id"] || message[:id]
        message.merge("read" => read_ids.key?(id.to_s))
      end
    end

    def archived_mailbox(mailbox)
      response = inbucket.mailbox(mailbox.name)
      message_count = response.status.between?(200, 299) && response.body.is_a?(Array) ? response.body.length : nil
      { name: mailbox.name, message_count: }
    rescue InbucketClient::Unavailable, InbucketClient::InvalidResponse
      { name: mailbox.name, message_count: nil }
    end
  end
end
