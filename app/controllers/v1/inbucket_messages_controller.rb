require "mail"

module V1
  class InbucketMessagesController < InbucketController
    INLINE_IMAGE_TYPES = %w[image/avif image/bmp image/gif image/jpeg image/png image/webp].freeze

    def show
      name = params.require(:name)
      id = params.require(:id)
      upstream = inbucket.message(name, id)
      return render_upstream(upstream, json: true) unless upstream.status.between?(200, 299)
      raise InbucketClient::InvalidResponse unless upstream.body.is_a?(Hash)

      indexed = indexed_message(name, id, upstream.body)
      starred = current_user.starred_messages.exists?(inbucket_message: indexed)
      render json: upstream.body.merge("starred" => starred), status: upstream.status
    end

    def mark_read
      name = params.require(:name)
      id = params.require(:id)
      upstream = inbucket.mark_seen(name, id)
      InbucketMessage.mark_seen(name, id) if upstream.status.between?(200, 299)
      render_destroy_upstream(upstream)
    end

    def starred
      records = current_user.starred_messages
                            .includes(:inbucket_message)
                            .joins(:inbucket_message)
                            .merge(InbucketMessage.available)
                            .order(updated_at: :desc)
      render json: records.map(&:rendered_summary)
    end

    def update_starred
      name = params.require(:name)
      id = params.require(:id)
      value = params.require(:starred)
      unless [true, false].include?(value)
        return render json: { error: "invalid_request" }, status: :unprocessable_content
      end

      return remove_star(name, id) unless value

      add_star(name, id)
    end

    def source
      response = inbucket.source(params.require(:name), params.require(:id))
      return render_upstream(response) unless response.status.between?(200, 299)

      render plain: response.body, content_type: "text/plain", status: response.status
    end

    def inline_image
      response = inbucket.source(params.require(:name), params.require(:id))
      return render_upstream(response) unless response.status.between?(200, 299)

      part = Mail.read_from_string(response.body).all_parts.find do |candidate|
        candidate.content_id.to_s.delete_prefix("<").delete_suffix(">").casecmp?(params.require(:cid)) && INLINE_IMAGE_TYPES.include?(candidate.mime_type)
      end
      return head :not_found unless part

      send_data part.decoded, type: part.mime_type, disposition: "inline"
    rescue Mail::Field::ParseError
      head :not_found
    end

    def attachments
      response = inbucket.source(params.require(:name), params.require(:id))
      return render_upstream(response) unless response.status.between?(200, 299)

      render json: attachment_parts(response.body).each_with_index.map { |part, index| attachment_metadata(part, index) }
    rescue Mail::Field::ParseError
      render json: { error: "invalid_message_source" }, status: :unprocessable_content
    end

    def attachment
      response = inbucket.source(params.require(:name), params.require(:id))
      return render_upstream(response) unless response.status.between?(200, 299)

      part = attachment_parts(response.body).fetch(Integer(params.require(:index), 10))
      self.response.headers["X-Content-Type-Options"] = "nosniff"
      send_data part.decoded, type: part.mime_type || "application/octet-stream", filename: part.filename || "attachment", disposition: "attachment"
    rescue Mail::Field::ParseError, ArgumentError, IndexError
      head :not_found
    end

    def destroy
      name = params.require(:name)
      id = params.require(:id)
      upstream = inbucket.delete_message(name, id)
      if upstream.status.between?(200, 299)
        InbucketMessage.with_mailbox_lock(name) { InbucketMessage.mark_unavailable(name, id) }
      end
      render_destroy_upstream(upstream)
    end

    private

    def add_star(name, id)
      upstream, record = InbucketMessage.with_mailbox_lock(name) do
        response = inbucket.message(name, id)
        next [response] unless response.status.between?(200, 299)
        raise InbucketClient::InvalidResponse unless response.body.is_a?(Hash)

        indexed = record_indexed_message(name, id, response.body)
        starred = current_user.starred_messages.find_or_create_by!(inbucket_message: indexed)
        [response, starred]
      end
      return render_upstream(upstream, json: true) unless upstream.status.between?(200, 299)

      render json: { starred: true, message: record.rendered_summary }
    end

    def remove_star(name, id)
      current_user.starred_messages
                  .joins(:inbucket_message)
                  .where(inbucket_messages: { mailbox: name, message_id: id })
                  .destroy_all
      render json: { starred: false }
    end

    def indexed_message(name, id, body)
      InbucketMessage.with_mailbox_lock(name) { record_indexed_message(name, id, body) }
    end

    def record_indexed_message(name, id, body)
      Mailbox.record(name)
      existing = InbucketMessage.find_by(mailbox: name, message_id: id)
      if existing&.available?
        existing.update_column(:direct_observed_at, Time.current)
        return existing
      end

      InbucketMessage.record(body.merge("mailbox" => name, "id" => id), source: :direct)
    end

    def attachment_parts(source)
      Mail.read_from_string(source).all_parts.select(&:attachment?)
    end

    def attachment_metadata(part, index)
      {
        index:,
        filename: part.filename || "attachment",
        content_type: part.mime_type || "application/octet-stream",
        size: part.decoded.bytesize,
      }
    end
  end
end
