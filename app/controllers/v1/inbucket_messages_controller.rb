require "mail"

module V1
  class InbucketMessagesController < InbucketController
    INLINE_IMAGE_TYPES = %w[image/avif image/bmp image/gif image/jpeg image/png image/webp].freeze

    def show
      render_upstream(inbucket.message(params.require(:name), params.require(:id)), json: true)
    end

    def mark_read
      render_destroy_upstream(inbucket.mark_seen(params.require(:name), params.require(:id)))
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
        MonitorMessage.where(mailbox: name, message_id: id).destroy_all
      end
      render_destroy_upstream(upstream)
    end

    private

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
