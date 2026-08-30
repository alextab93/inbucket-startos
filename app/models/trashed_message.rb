class TrashedMessage < ApplicationRecord
  belongs_to :inbucket_message
  belongs_to :user

  validates :inbucket_message_id, uniqueness: { scope: :user_id }

  scope :ordered, -> { order(trashed_at: :desc, id: :desc) }

  def rendered_summary
    inbucket_message.rendered_summary(
      starred: user.starred_messages.exists?(inbucket_message:),
      tags: Tag.lookup(user:, messages: [inbucket_message.rendered_summary])
               .fetch([inbucket_message.mailbox, inbucket_message.message_id], [])
    ).merge(
      "available" => inbucket_message.available?,
      "trashed_at" => trashed_at.iso8601(6)
    )
  end
end
