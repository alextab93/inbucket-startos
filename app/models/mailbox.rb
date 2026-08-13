class Mailbox < ApplicationRecord
  normalizes :name, with: ->(name) { name.strip }

  validates :name, presence: true, length: { maximum: 255 }, uniqueness: true

  scope :active, -> { where(archived: false) }
  scope :archived, -> { where(archived: true) }

  def self.record(name, restore: false)
    normalized_name = name.to_s.strip
    return if normalized_name.empty?

    mailbox = find_or_create_by!(name: normalized_name)
    mailbox.update!(archived: false) if restore && mailbox.archived?
    mailbox
  end
end
