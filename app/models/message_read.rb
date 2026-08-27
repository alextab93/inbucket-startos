class MessageRead < ApplicationRecord
  belongs_to :user

  normalizes :mailbox, :message_id, with: ->(value) { value.strip }

  validates :mailbox, :message_id, presence: true, length: { maximum: 255 }

  def self.record(user:, mailbox:, message_id:)
    create_or_find_by!(user:, mailbox:, message_id:) do |message_read|
      message_read.read_at = Time.current
    end
  end
end
