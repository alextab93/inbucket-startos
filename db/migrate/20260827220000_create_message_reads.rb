class CreateMessageReads < ActiveRecord::Migration[8.0]
  def change
    create_table :message_reads do |t|
      t.references :user, null: false, foreign_key: true
      t.string :mailbox, null: false
      t.string :message_id, null: false
      t.datetime :read_at, null: false

      t.timestamps
    end

    add_index :message_reads, %i[user_id mailbox message_id], unique: true
  end
end
