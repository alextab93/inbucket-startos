# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_08_27_220000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "mailboxes", force: :cascade do |t|
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "archived", default: false, null: false
    t.index ["archived"], name: "index_mailboxes_on_archived"
    t.index ["name"], name: "index_mailboxes_on_name", unique: true
  end

  create_table "message_reads", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "mailbox", null: false
    t.string "message_id", null: false
    t.datetime "read_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "mailbox", "message_id"], name: "index_message_reads_on_user_id_and_mailbox_and_message_id", unique: true
    t.index ["user_id"], name: "index_message_reads_on_user_id"
  end

  create_table "monitor_messages", force: :cascade do |t|
    t.string "mailbox", null: false
    t.string "message_id", null: false
    t.jsonb "header", default: {}, null: false
    t.datetime "received_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["mailbox", "message_id"], name: "index_monitor_messages_on_mailbox_and_message_id", unique: true
    t.index ["received_at"], name: "index_monitor_messages_on_received_at"
  end

  create_table "user_sessions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "token_digest", null: false
    t.datetime "expires_at", null: false
    t.datetime "revoked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["expires_at"], name: "index_user_sessions_on_expires_at"
    t.index ["token_digest"], name: "index_user_sessions_on_token_digest", unique: true
    t.index ["user_id"], name: "index_user_sessions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "username", null: false
    t.string "password_digest", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "lower((username)::text)", name: "index_users_on_lower_username", unique: true
  end

  add_foreign_key "message_reads", "users"
  add_foreign_key "user_sessions", "users"
end
