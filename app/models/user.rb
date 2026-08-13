class User < ApplicationRecord
  has_secure_password

  has_many :user_sessions, dependent: :destroy

  normalizes :username, with: ->(username) { username.strip.downcase }

  validates :username, presence: true, uniqueness: { case_sensitive: false }
  validates :password, length: { minimum: 12 }, allow_nil: true
end
