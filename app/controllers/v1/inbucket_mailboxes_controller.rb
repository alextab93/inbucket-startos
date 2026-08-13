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
      Mailbox.record(name) if upstream.status.between?(200, 299) && upstream.body.is_a?(Array) && upstream.body.any?
      render_upstream(upstream, json: true)
    end

    def destroy
      name = params.require(:name)
      upstream = inbucket.purge_mailbox(name)
      if upstream.status.between?(200, 299)
        Mailbox.where(name: name).destroy_all
        MonitorMessage.where(mailbox: name).destroy_all
      end
      render_destroy_upstream(upstream)
    end

    def archive
      mailbox = Mailbox.find_by!(name: params.require(:name))
      mailbox.update!(archived: params[:archived] != "false")
      head :no_content
    end

    private

    def archived_mailbox(mailbox)
      response = inbucket.mailbox(mailbox.name)
      message_count = response.status.between?(200, 299) && response.body.is_a?(Array) ? response.body.length : nil
      { name: mailbox.name, message_count: }
    rescue InbucketClient::Unavailable, InbucketClient::InvalidResponse
      { name: mailbox.name, message_count: nil }
    end
  end
end
