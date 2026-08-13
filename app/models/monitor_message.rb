class MonitorMessage < ApplicationRecord
  validates :mailbox, :message_id, presence: true

  def self.record(header)
    mailbox = header["mailbox"].to_s.strip
    message_id = header["id"].to_s.strip
    return if mailbox.empty? || message_id.empty?

    message = find_or_initialize_by(mailbox:, message_id:)
    message.header = header
    message.received_at = header["date"]
    message.save!
  end
end
